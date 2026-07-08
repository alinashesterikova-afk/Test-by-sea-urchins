import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");
const clientDir = path.join(outDir, "client");
const serverDir = path.join(outDir, "server");
const openaiDir = path.join(outDir, ".openai");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(clientDir, { recursive: true });
fs.mkdirSync(serverDir, { recursive: true });
fs.mkdirSync(openaiDir, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "shared-data.js"]) {
  fs.copyFileSync(path.join(root, file), path.join(clientDir, file));
}

fs.copyFileSync(path.join(root, ".openai", "hosting.json"), path.join(openaiDir, "hosting.json"));

fs.writeFileSync(
  path.join(serverDir, "index.js"),
  `const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const clientRoot = path.resolve(__dirname, "..", "client");
const port = Number(process.env.PORT || 3000);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const rel = decoded.startsWith("/") ? decoded.slice(1) : decoded;
  const abs = path.normalize(path.join(rootDir, rel));
  if (!abs.startsWith(rootDir)) return null;
  return abs;
}

function sendFile(res, filePath) {
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", \`http://\${req.headers.host || "localhost"}\`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = safeJoin(clientRoot, requestPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  sendFile(res, filePath);
});

server.listen(port, () => {
  process.stdout.write(\`http://localhost:\${port}\\n\`);
});
`,
);

process.stdout.write(`Built ${outDir}\n`);
