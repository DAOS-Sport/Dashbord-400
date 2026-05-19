import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { MODULE_REGISTRY } from "../shared/modules";

const repoRoot = process.cwd();
const roots = ["client/src/modules", "client/src/pages"];
const replacementChar = "\uFFFD";

const read = (path: string) => readFileSync(path, "utf8");

const walk = (dir: string): string[] => {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    return /\.(tsx|ts)$/.test(entry) ? [full] : [];
  });
};

const files = roots.flatMap((root) => walk(join(repoRoot, root)));
const badEncoding = files.filter((file) => read(file).includes(replacementChar));

if (badEncoding.length) {
  throw new Error(`Title/content encoding guard failed. Replacement character found in: ${badEncoding.map((file) => relative(repoRoot, file)).join(", ")}`);
}

const labels = new Set(MODULE_REGISTRY.map((module) => module.label));
const hardcodedHeadingRows: string[] = [];
const h1Pattern = /<h1[^>]*>([\s\S]*?)<\/h1>/g;

for (const file of files) {
  const source = read(file);
  for (const match of source.matchAll(h1Pattern)) {
    const text = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && !labels.has(text)) {
      hardcodedHeadingRows.push(`${relative(repoRoot, file)} :: ${text}`);
    }
  }
}

console.log("Title binding check");
console.log("===================");
console.log("replacement characters: none");
console.log(`hardcoded h1 candidates queued for cleanup-backlog: ${hardcodedHeadingRows.length}`);
for (const row of hardcodedHeadingRows.slice(0, 25)) {
  console.log(`- ${row}`);
}
