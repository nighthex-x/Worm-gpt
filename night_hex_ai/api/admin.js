
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAIL
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) {
    return res.status(503).json({
      error: "Admin environment is not configured"
    });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      error: "Sign in required"
    });
  }

  try {
    const admin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false }
      }
    );

    // Verify the signed-in user
    const { data: userData, error: userError } =
      await admin.auth.getUser(token);

    if (userError || !userData.user) {
      return res.status(401).json({
        error: "Invalid session"
      });
    }

    // Check admin email
    const userEmail = (userData.user.email || "")
      .trim()
      .toLowerCase();

    const allowedEmail = ADMIN_EMAIL.trim().toLowerCase();

    if (!userEmail || userEmail !== allowedEmail) {
      return res.status(403).json({
        error: "Admin access denied"
      });
    }

    // Load admin dashboard data
    const [
      { data: usersData, error: usersError },
      { count: chats, error: chatsError },
      { count: messages, error: messagesError }
    ] = await Promise.all([
      admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      }),

      admin.from("chats")
        .select("*", { count: "exact", head: true }),

      admin.from("messages")
        .select("*", { count: "exact", head: true })
    ]);

    if (usersError || !usersData) {
      return res.status(500).json({
        error: "Could not load users"
      });
    }

    if (chatsError || messagesError) {
      return res.status(500).json({
        error: "Could not load dashboard statistics"
      });
    }

    return res.status(200).json({
      totals: {
        users: usersData.users.length,
        chats: chats || 0,
        messages: messages || 0
      },

      users: usersData.users.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at
      }))
    });

  } catch (error) {
    console.error("Admin API error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
