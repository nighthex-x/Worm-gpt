import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { text, uid } = req.body || {};
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message is required" });
    if (text.length > 12000) return res.status(413).json({ error: "Message is too long" });

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const PROJECT_URL = "https://mskcclqkvmurlcwwfgyr.supabase.co";
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: "Service is temporarily unavailable. Please try again later." });
    const db = createClient(PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const authPromise = token ? db.auth.getUser(token) : Promise.resolve({ data: { user: null }, error: null });
    // Verify auth and read maintenance in parallel to reduce pre-response latency.
    const [authResult, settingResult] = await Promise.all([
      authPromise,
      db.from("site_settings").select("maintenance_enabled,maintenance_message").eq("id", 1).maybeSingle()
    ]);
    let verifiedUser = authResult.data?.user || null;
    if (token && (authResult.error || !verifiedUser)) return res.status(401).json({ error: "Please sign in again" });
    if (verifiedUser?.banned_until && new Date(verifiedUser.banned_until) > new Date()) return res.status(403).json({ error: `This account is blocked until ${verifiedUser.banned_until}` });
    if (settingResult.error) return res.status(503).json({ error: "NIGHT HEX AI is temporarily unavailable while the service is being checked." });

    let maintenanceActive = !!settingResult.data?.maintenance_enabled;
    let maintenanceMessage = settingResult.data?.maintenance_message || "NIGHT HEX AI is under maintenance.";
    const expiryMatch = maintenanceMessage.match(/\n?\[\[NH_EXPIRES:(.*?)\]\]$/);
    if (expiryMatch) {
      const expiry = new Date(expiryMatch[1]);
      maintenanceMessage = maintenanceMessage.replace(/\n?\[\[NH_EXPIRES:.*?\]\]$/, "");
      if (!Number.isNaN(expiry.getTime()) && expiry <= new Date()) {
        maintenanceActive = false;
        const { error: expiryError } = await db.from("site_settings").update({ maintenance_enabled: false, maintenance_message: maintenanceMessage, updated_at: new Date().toISOString() }).eq("id", 1);
        if (expiryError) console.warn("Could not persist maintenance expiry:", expiryError.message);
      }
    }
    const adminUser = !!(verifiedUser?.email && process.env.ADMIN_EMAIL && verifiedUser.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase());
    if (maintenanceActive && !adminUser) return res.status(503).json({ error: maintenanceMessage });

    // Analytics must not delay the first AI token; record it in the background.
    if (verifiedUser) {
      const category = /code|javascript|python|html|css|program|debug/i.test(text) ? "coding" : /write|email|post|caption|story|letter/i.test(text) ? "writing" : /math|calculate|equation| হিসাব/i.test(text) ? "learning" : /translate|অনুবাদ/i.test(text) ? "translation" : "general";
      db.from("usage_events").insert({ user_id: verifiedUser.id, category })
        .then(({ error }) => { if (error) console.warn("Usage event not recorded:", error.message); })
        .catch(error => console.warn("Usage event request failed:", error?.message || error));
    }

    const safeUid = typeof uid === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(uid) ? uid : "guest";
    const url = new URL("https://xrahat-worm-ai.vercel.app/api/chat");
    // Keep the user's prompt untouched so the upstream assistant answers the actual question.
    // Branding is corrected narrowly in the client only if the provider names itself incorrectly.
    url.searchParams.set("text", text); url.searchParams.set("uid", safeUid); url.searchParams.set("stream", "1");
    const clientController = new AbortController();
    const abortIfClientLeaves = () => { if (!res.writableEnded) clientController.abort(); };
    res.on("close", abortIfClientLeaves);
    const upstream = await fetch(url, { headers: { Accept: "text/event-stream" }, signal: AbortSignal.any([clientController.signal, AbortSignal.timeout(55000)]) });
    if (!upstream.ok) { const detail = await upstream.text(); return res.status(502).json({ error: `AI provider returned ${upstream.status}`, detail: detail.slice(0, 300) }); }
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.body) return res.status(502).json({ error: "AI provider returned no response stream" });
    res.status(200); res.setHeader("Content-Type", type.includes("text/event-stream") ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    const reader = upstream.body.getReader();
    while (true) { const { value, done } = await reader.read(); if (done) break; if (!res.write(Buffer.from(value))) await new Promise(resolve => res.once("drain", resolve)); if (typeof res.flush === "function") res.flush(); }
    res.end();
    res.removeListener("close", abortIfClientLeaves);
  } catch (error) {
    console.error("Chat API error:", error);
    if (!res.headersSent) return res.status(502).json({ error: "Could not connect to AI provider. Please try again." });
    if (!res.writableEnded) res.end();
  }
}
