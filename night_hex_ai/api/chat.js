export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { text, uid } = req.body || {};
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message is required" });
    if (text.length > 12000) return res.status(413).json({ error: "Message is too long" });
    const safeUid = typeof uid === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(uid) ? uid : "guest";
    const url = new URL("https://xrahat-worm-ai.vercel.app/api/chat");
    url.searchParams.set("text", text);
    url.searchParams.set("uid", safeUid);
    url.searchParams.set("stream", "1");
    const upstream = await fetch(url, { headers: { Accept: "text/event-stream" }, signal: AbortSignal.timeout(55000) });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: `AI provider returned ${upstream.status}`, detail: detail.slice(0, 300) });
    }
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.body) return res.status(502).json({ error: "AI provider returned no response stream" });
    res.status(200);
    res.setHeader("Content-Type", type.includes("text/event-stream") ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (e) {
      res.end();
    }
  } catch (e) {
    if (!res.headersSent) return res.status(502).json({ error: "Could not connect to AI provider. Please try again." });
    res.end();
  }
}