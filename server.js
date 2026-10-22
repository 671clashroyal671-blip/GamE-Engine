import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const ollama = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 500_000) throw new Error("Request too large");
  }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      try {
        const r = await fetch(ollama + "/api/tags", { signal: AbortSignal.timeout(1500) });
        const data = await r.json();
        return send(res, 200, { connected: r.ok, models: (data.models || []).map(m => m.name) });
      } catch {
        return send(res, 200, { connected: false, models: [] });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readBody(req);
      if (!body.model || !Array.isArray(body.messages)) return send(res, 400, { error: "A model and message history are required." });
      try {
        const r = await fetch(ollama + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: body.model, messages: body.messages.slice(-30), stream: false }),
          signal: AbortSignal.timeout(180_000)
        });
        const data = await r.json();
        if (!r.ok) return send(res, r.status, { error: data.error || "Local model request failed." });
        return send(res, 200, { message: data.message?.content || "", model: data.model || body.model });
      } catch {
        return send(res, 503, { error: "Cannot reach Ollama. Start Ollama and try again." });
      }
    }
    if (req.method === "GET" && url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
      if (!q) return send(res, 400, { error: "A search query is required." });
      const webUrl = "https://duckduckgo.com/?q=" + encodeURIComponent(q);
      try {
        const api = new URL("https://en.wikipedia.org/w/api.php");
        for (const [k, v] of Object.entries({ action: "query", list: "search", srsearch: q, srlimit: "5", format: "json", origin: "*" })) api.searchParams.set(k, v);
        const r = await fetch(api, { headers: { "User-Agent": "LittleHouseAI/0.1" }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error("Search unavailable");
        const data = await r.json();
        return send(res, 200, {
          webUrl,
          results: (data.query?.search || []).map(item => ({
            title: item.title,
            snippet: item.snippet.replace(/<[^>]*>/g, ""),
            url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(item.title.replace(/ /g, "_"))
          }))
        });
      } catch {
        return send(res, 502, { error: "Reference search is unavailable.", webUrl });
      }
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed." });
    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep)) return send(res, 403, { error: "Forbidden." });
    try {
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
      return req.method === "HEAD" ? res.end() : res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
  } catch {
    return send(res, 400, { error: "Invalid request." });
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Little House AI: http://localhost:${port}`));
