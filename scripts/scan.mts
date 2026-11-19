/**
 * Run a scan from the command line (or a scheduler):
 *   npm run scan
 *   npm run scan -- --max-evaluations 5
 */
import { runScan } from "../src/lib/scan.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};

const result = await runScan({
  maxEvaluations: flag("--max-evaluations"),
  minPreScore: flag("--min-prescore"),
  log: (m) => console.log(m),
});
console.log(JSON.stringify({ ...result, errors: result.errors.slice(0, 20) }, null, 2));
