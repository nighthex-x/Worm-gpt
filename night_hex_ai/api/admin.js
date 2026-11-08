import { createClient } from "@supabase/supabase-js";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) return res.status(503).json({ error: "Admin environment is not configured" });
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Sign in required" });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user || userData.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: "Admin access denied" });
  const [{ data: users, error: usersError }, { count: chats }, { count: messages }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("chats").select("*", { count: "exact", head: true }),
    admin.from("messages").select("*", { count: "exact", head: true })
  ]);
  if (usersError) return res.status(500).json({ error: "Could not load users" });
  res.status(200).json({
    totals: { users: users.users.length, chats: chats || 0, messages: messages || 0 },
    users: users.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at }))
  });
}