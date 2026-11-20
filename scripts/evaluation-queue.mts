/**
 * Claude scoring without an API key. The scheduled daily-scan session (which is
 * Claude) evaluates new opportunities itself:
 *
 *   npm run eval-queue -- out.json [max]      write the opportunities to evaluate
 *   (Claude writes evaluations.json: [{ id, score, whyItFits, ... }])
 *   npm run apply-evals -- evaluations.json   validate and merge them
 *
 * Picks unevaluated, open opportunities with no hard blockers and a
 * pre-score of 40+, highest first.
 */
import { promises as fs } from "node:fs";
import { isOpen } from "../src/lib/dashboard.ts";
import { listOpportunities } from "../src/lib/store/index.ts";

const out = process.argv[2] ?? "eval-queue.json";
const max = Number(process.argv[3] ?? 15);
const all = await listOpportunities();
const queue = all
  .filter((o) => !o.evaluation && isOpen(o) && o.screening && !o.screening.blockers.length && o.screening.preScore >= 40)
  .sort((a, b) => b.screening!.preScore - a.screening!.preScore)
  .slice(0, max)
  .map((o) => ({
    id: o.id, title: o.title, agency: o.agency, number: o.number, deadline: o.closeDate, types: o.mechanisms,
    award: { floor: o.awardFloor, ceiling: o.awardCeiling, total: o.estimatedFunding, count: o.expectedAwards },
    costSharing: o.costSharing, eligibility: o.eligibilityText?.slice(0, 3000), description: o.description?.slice(0, 6000),
    automatedChecks: o.screening?.criteria.map((c) => `${c.label}: ${c.status} (${c.evidence})`), leadRole: o.screening?.leadRole,
  }));
await fs.writeFile(out, JSON.stringify(queue, null, 1));
console.log(`${queue.length} opportunities to evaluate -> ${out}`);
