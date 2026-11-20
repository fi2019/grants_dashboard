/**
 * Merge evaluations written by Claude (see scripts/evaluation-queue.mts) into
 * the opportunity store, validating each one first.
 *   npm run apply-evals -- evaluations.json
 */
import { promises as fs } from "node:fs";
import { z } from "zod";
import { tierFor } from "../src/lib/evaluation/claude.ts";
import { getOpportunity, updateDecision, upsertOpportunities } from "../src/lib/store/index.ts";

const Item = z.object({
  id: z.string(),
  score: z.number().int().min(1).max(10),
  whyItFits: z.string().min(20),
  proposedProject: z.string(),
  targetClients: z.string(),
  recommendedPartners: z.array(z.string()),
  whyForgeQualifies: z.string(),
  risks: z.array(z.string()),
  forgeRole: z.enum(["lead", "partner", "either"]),
  roleRationale: z.string(),
});

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run apply-evals -- evaluations.json");
const raw = JSON.parse(await fs.readFile(file, "utf8"));
const now = new Date().toISOString();
const updates = [];
const problems: string[] = [];
for (const [i, entry] of (Array.isArray(raw) ? raw : []).entries()) {
  const parsed = Item.safeParse(entry);
  if (!parsed.success) { problems.push(`#${i} (${entry?.id ?? "no id"}): ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`); continue; }
  const o = await getOpportunity(parsed.data.id);
  if (!o) { problems.push(`#${i}: no opportunity ${parsed.data.id}`); continue; }
  const { id: _id, ...ev } = parsed.data;
  o.evaluation = { ...ev, tier: tierFor(ev.score), model: "Claude (scheduled daily scan)", evaluatedAt: now };
  updates.push(o);
}
await upsertOpportunities(updates);
// Strong fits move from New to Screening (upsert keeps the stored stage, so set it separately).
for (const o of updates) if (o.evaluation!.score >= 6 && o.stage === "new") await updateDecision(o.id, { stage: "screening" });
console.log(`Applied ${updates.length} evaluations.${problems.length ? ` Skipped ${problems.length}:\n- ${problems.join("\n- ")}` : ""}`);
if (problems.length && !updates.length) process.exit(1);
