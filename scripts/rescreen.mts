/**
 * Re-run the rule-based screen on stored opportunities after changing the
 * screening rules, without fetching from sources again. Keeps Claude
 * evaluations and the team's decisions.
 *   npm run rescreen                 (data/opportunities.json, else data/seed.json)
 *   npm run rescreen -- data/seed.json
 */
import { promises as fs } from "node:fs";
import { screen } from "../src/lib/screening/criteria.ts";
import { classifyMechanisms } from "../src/lib/screening/mechanism.ts";
import { fetchDetails } from "../src/lib/sources/grants-gov.ts";

const file = process.argv[2]
  ?? (await fs.access("data/opportunities.json").then(() => "data/opportunities.json", () => "data/seed.json"));
const db = JSON.parse(await fs.readFile(file, "utf8"));
const roles: Record<string, number> = {};
for (const o of db.opportunities) {
  // Funding-instrument codes came later; fetch them once for older records.
  if (!o.fundingInstruments && o.source === "grants.gov") {
    try { o.fundingInstruments = (await fetchDetails(o.id.split(":")[1])).fundingInstruments ?? []; } catch { o.fundingInstruments = []; }
  }
  o.screening = screen(o);
  o.mechanisms = classifyMechanisms(o);
  roles[o.screening.leadRole] = (roles[o.screening.leadRole] ?? 0) + 1;
}
await fs.writeFile(file, JSON.stringify(db, null, 1));
console.log(`Re-screened ${db.opportunities.length} opportunities in ${file}`, roles);
