import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) return res.status(503).json({ error: "Admin environment is not configured" });
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Sign in required" });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: "Invalid session" });
    if ((authData.user.email || "").trim().toLowerCase() !== ADMIN_EMAIL.trim().toLowerCase()) return res.status(403).json({ error: "Admin access denied" });

    if (req.method === "POST") {
      const { action, userId, duration } = req.body || {};
      if (typeof userId !== "string" || !userId) return res.status(400).json({ error: "User ID is required" });
      if (userId === authData.user.id) return res.status(400).json({ error: "You cannot block your own admin account" });
      if (action === "unban") {
        const { data, error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, banned_until: data.user.banned_until || null });
      }
      if (action === "ban") {
        const durations = new Set(["1h", "24h", "7d", "30d", "876000h"]);
        if (!durations.has(duration)) return res.status(400).json({ error: "Invalid block duration" });
        const { data, error } = await admin.auth.admin.updateUserById(userId, { ban_duration: duration });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, banned_until: data.user.banned_until || null });
      }
      return res.status(400).json({ error: "Unknown admin action" });
    }

    const [usersResult, chatsResult, messagesResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("chats").select("*", { count: "exact", head: true }),
      admin.from("messages").select("*", { count: "exact", head: true })
    ]);
    if (usersResult.error) return res.status(500).json({ error: "Could not load users" });
    if (chatsResult.error || messagesResult.error) return res.status(500).json({ error: "Could not load dashboard statistics" });
    return res.status(200).json({
      totals: { users: usersResult.data.users.length, chats: chatsResult.count || 0, messages: messagesResult.count || 0 },
      users: usersResult.data.users.map(user => ({ id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at, email_confirmed_at: user.email_confirmed_at, banned_until: user.banned_until || null }))
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
