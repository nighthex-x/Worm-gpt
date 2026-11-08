import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { text, uid } = req.body || {};
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message is required" });
    if (text.length > 12000) return res.status(413).json({ error: "Message is too long" });

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (token && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error: "Please sign in again" });
      if (data.user.banned_until && new Date(data.user.banned_until) > new Date()) return res.status(403).json({ error: `This account is blocked until ${data.user.banned_until}` });
    }

    // Maintenance mode is enforced on the server, not only hidden in the browser.
    let adminUser = false;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: setting } = await db.from("site_settings").select("maintenance_enabled,maintenance_message").eq("id", 1).maybeSingle();
      const authHeader2 = req.headers.authorization || "";
      const token2 = authHeader2.startsWith("Bearer ") ? authHeader2.slice(7).trim() : "";
      if (token2 && process.env.ADMIN_EMAIL) {
        const { data: a } = await db.auth.getUser(token2);
        adminUser = !!a?.user?.email && a.user.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase();
      }
      if (setting?.maintenance_enabled && !adminUser) return res.status(503).json({ error: setting.maintenance_message || "NIGHT HEX AI is under maintenance." });
      if (token2) {
        const { data: a } = await db.auth.getUser(token2);
        if (a?.user) {
          const category = /code|javascript|python|html|css|program|debug/i.test(text) ? "coding" : /write|email|post|caption|story|letter/i.test(text) ? "writing" : /math|calculate|equation| হিসাব/i.test(text) ? "learning" : /translate|অনুবাদ/i.test(text) ? "translation" : "general";
          await db.from("usage_events").insert({ user_id: a.user.id, category });
        }
      }
    }

    const safeUid = typeof uid === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(uid) ? uid : "guest";
    const url = new URL("https://xrahat-worm-ai.vercel.app/api/chat");
    url.searchParams.set("text", text); url.searchParams.set("uid", safeUid); url.searchParams.set("stream", "1");
    const upstream = await fetch(url, { headers: { Accept: "text/event-stream" }, signal: AbortSignal.timeout(55000) });
    if (!upstream.ok) { const detail = await upstream.text(); return res.status(502).json({ error: `AI provider returned ${upstream.status}`, detail: detail.slice(0, 300) }); }
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.body) return res.status(502).json({ error: "AI provider returned no response stream" });
    res.status(200); res.setHeader("Content-Type", type.includes("text/event-stream") ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.setHeader("X-Accel-Buffering", "no");
    const reader = upstream.body.getReader();
    while (true) { const { value, done } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
    res.end();
  } catch (error) {
    console.error("Chat API error:", error);
    if (!res.headersSent) return res.status(502).json({ error: "Could not connect to AI provider. Please try again." });
    res.end();
  }
}
