import { createClient } from "@supabase/supabase-js";

const json = (res, status, body) => {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) {
    return json(res, 503, { error: "Admin service is not configured" });
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 4096) return json(res, 401, { error: "Sign in required" });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    // Validate the access token with Supabase; never trust client-side role/metadata.
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json(res, 401, { error: "Invalid or expired session" });

    const configuredAdmin = ADMIN_EMAIL.trim().toLowerCase();
    const signedInEmail = (user.email || "").trim().toLowerCase();
    if (!configuredAdmin || !signedInEmail || signedInEmail !== configuredAdmin) {
      return json(res, 403, { error: "Admin access denied" });
    }

    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const { action, userId, duration } = body;
      if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
        return json(res, 400, { error: "A valid user ID is required" });
      }
      if (userId === user.id) return json(res, 400, { error: "The administrator account cannot be blocked" });

      // Never allow the configured administrator account to be modified, even if a
      // request is manually crafted outside the dashboard UI.
      const { data: targetResult, error: targetError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (targetError || !targetResult?.user) return json(res, 404, { error: "User not found" });
      if ((targetResult.user.email || "").trim().toLowerCase() === configuredAdmin) {
        return json(res, 403, { error: "The administrator account is protected" });
      }

      if (action === "unban") {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
        if (error) return json(res, 400, { error: "Could not unblock this account" });
        return json(res, 200, { success: true, banned_until: data.user.banned_until || null });
      }

      if (action === "ban") {
        const allowedDurations = new Set(["1h", "24h", "7d", "30d", "876000h"]);
        if (!allowedDurations.has(duration)) return json(res, 400, { error: "Invalid block duration" });
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: duration });
        if (error) return json(res, 400, { error: "Could not block this account" });
        return json(res, 200, { success: true, banned_until: data.user.banned_until || null });
      }
      return json(res, 400, { error: "Unknown admin action" });
    }

    const [usersResult, chatsResult, messagesResult] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("chats").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("messages").select("id", { count: "exact", head: true })
    ]);

    if (usersResult.error) return json(res, 500, { error: "Could not load users" });
    if (chatsResult.error || messagesResult.error) return json(res, 500, { error: "Could not load dashboard statistics" });

    const safeUsers = (usersResult.data.users || []).map(account => ({
      id: account.id,
      email: account.email || null,
      created_at: account.created_at || null,
      last_sign_in_at: account.last_sign_in_at || null,
      email_confirmed_at: account.email_confirmed_at || null,
      banned_until: account.banned_until || null
    }));

    return json(res, 200, {
      admin: { email: user.email },
      totals: {
        users: safeUsers.length,
        chats: chatsResult.count || 0,
        messages: messagesResult.count || 0
      },
      users: safeUsers
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return json(res, 500, { error: "Internal server error" });
  }
}
