import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// __dirname equivalente no ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// require compatível dentro de ESM
const require = createRequire(import.meta.url);

// resolve o pacote corretamente
const pkgJsonPath = require.resolve("@iconify-json/material-symbols/package.json");
const pkgDir = path.dirname(pkgJsonPath);
const iconsJsonPath = path.join(pkgDir, "icons.json");

// lê o icons.json completo
const raw = JSON.parse(fs.readFileSync(iconsJsonPath, "utf-8"));

// extrai apenas os nomes
const names = Object.keys(raw?.icons || {}).sort();

// garante pasta src/data
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "src", "data");
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, "materialSymbols.names.json");
fs.writeFileSync(outFile, JSON.stringify(names, null, 2));

console.log(`✅ ${names.length} nomes salvos em:`);
console.log(outFile);