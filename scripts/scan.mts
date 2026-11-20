/**
 * Run a scan from the command line (or a scheduler):
 *   npm run scan
 *   npm run scan -- --max-evaluations 5
 *   npm run scan -- --keywords keywords.json   (extra search keywords: a JSON array of
 *     strings, or a folder of keyword .json files exported from the hosted page)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { runScan } from "../src/lib/scan.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};

async function loadKeywords(p?: string): Promise<string[]> {
  if (!p) return [];
  if ((await fs.stat(p)).isDirectory()) {
    const files = (await fs.readdir(p)).filter((f) => f.endsWith(".json"));
    const docs = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(p, f), "utf8"))));
    return docs.flatMap((d) => [d.keyword, d.term, d.text, d.name, ...(Array.isArray(d.keywords) ? d.keywords : []), ...(Array.isArray(d.searchKeywords) ? d.searchKeywords : [])]).filter((x): x is string => typeof x === "string");
  }
  const raw = JSON.parse(await fs.readFile(p, "utf8"));
  return Array.isArray(raw) ? raw.map(String) : [];
}
const ki = args.indexOf("--keywords");
const extraKeywords = await loadKeywords(ki >= 0 ? args[ki + 1] : undefined);
if (extraKeywords.length) console.log(`Using ${extraKeywords.length} extra keywords from the hosted page`);

const result = await runScan({
  extraKeywords,
  maxEvaluations: flag("--max-evaluations"),
  minPreScore: flag("--min-prescore"),
  log: (m) => console.log(m),
});
console.log(JSON.stringify({ ...result, errors: result.errors.slice(0, 20) }, null, 2));
