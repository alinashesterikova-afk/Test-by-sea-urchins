import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);

const videoExts = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"]);

function findVideoSource(rootDir) {
  const queue = [rootDir];
  while (queue.length) {
    const dir = queue.shift();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git") continue;
        queue.push(abs);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (videoExts.has(ext) && path.parse(entry.name).name.toLowerCase() === "video") {
        return `/${path.relative(rootDir, abs).split(path.sep).map(encodeURIComponent).join("/")}`;
      }
    }
  }
  return "";
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".m4v") return "video/x-m4v";
  if (ext === ".ogv" || ext === ".ogg") return "video/ogg";
  return "application/octet-stream";
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const rel = decoded.startsWith("/") ? decoded.slice(1) : decoded;
  const abs = path.normalize(path.join(rootDir, rel));
  if (!abs.startsWith(rootDir)) return null;
  return abs;
}

const videoSrc = findVideoSource(__dirname);

function sendFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const isVideo = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"].includes(ext);
  const range = req.headers.range;

  if (isVideo && range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start <= end && end < stat.size) {
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Type": contentType(filePath),
          "Content-Length": chunkSize,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }

  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/__video-src") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ src: videoSrc }));
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = safeJoin(__dirname, requestPath);

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  sendFile(req, res, filePath);
});

server.listen(port, () => {
  process.stdout.write(`http://localhost:${port}\n`);
});
