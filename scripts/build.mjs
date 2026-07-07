import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "server.mjs", "package.json"]) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}

process.stdout.write(`Built ${outDir}\n`);
