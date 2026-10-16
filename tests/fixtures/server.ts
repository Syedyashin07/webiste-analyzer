import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, "site");
const PORT = Number(process.env.FIXTURE_PORT ?? 4545);

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

export function createFixtureServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/status/500") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("intentional server error");
      return;
    }
    if (url.pathname === "/slow.js") {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end("console.log('slow');");
      }, 1200);
      return;
    }
    let filePath = path.join(site, url.pathname === "/" ? "index.html" : url.pathname);
    if (!filePath.startsWith(site)) {
      res.writeHead(400);
      res.end("bad path");
      return;
    }
    if (!path.extname(filePath)) filePath += ".html";
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] ?? "application/octet-stream" });
      res.end(data);
    });
  });
}

if (process.argv[1] && path.normalize(process.argv[1]).includes("server.ts")) {
  const server = createFixtureServer();
  server.listen(PORT, () => {
    console.log(`Fixture site http://127.0.0.1:${PORT}`);
  });
}
