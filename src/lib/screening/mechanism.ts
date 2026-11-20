/**
 * What kind of funding vehicle an opportunity is: SBIR, STTR, BAA, Grant,
 * Cooperative agreement, Contract, OT, CSO, Prize, Fellowship, RFI, NOI,
 * Forecast. An opportunity can carry several (an SBIR BAA, a forecasted grant).
 * Uses the listing's funding-instrument codes when the source gives them and
 * the title / number / description otherwise.
 */
import type { Opportunity } from "../types";

export const MECHANISMS = [
  "SBIR", "STTR", "BAA", "CSO", "OT", "Prize / challenge", "Fellowship", "RFI", "Notice of intent", "Forecast",
  "Grant", "Cooperative agreement", "Contract", "Other",
] as const;
export type Mechanism = (typeof MECHANISMS)[number];

/** Grants.gov funding-instrument codes. */
const INSTRUMENT: Record<string, Mechanism> = { G: "Grant", CA: "Cooperative agreement", PC: "Contract", O: "Other" };

const RULES: { m: Mechanism; where: "title" | "all"; re: RegExp }[] = [
  // SBIR/STTR only from the title or number: many descriptions mention them in passing.
  { m: "SBIR", where: "title", re: /\bSBIR\b|small business innovation research/i },
  { m: "STTR", where: "title", re: /\bSTTR\b|small business technology transfer/i },
  { m: "BAA", where: "all", re: /\bBAA\b|broad agency announcement|research announcement \(RA\)/i },
  { m: "CSO", where: "all", re: /commercial solutions? opening|\bCSO\b/i },
  // "OT" alone collides with operational technology, so only the spelled-out forms count.
  { m: "OT", where: "all", re: /other transactions? (authority|agreement)|\bOTA\b|prototype (OT|other transaction)/i },
  { m: "Prize / challenge", where: "all", re: /prize competition|\bprize\b|challenge\.gov|\bxTech/i },
  { m: "Fellowship", where: "title", re: /fellowship|postdoctoral/i },
  { m: "RFI", where: "title", re: /request for information|\bRFI\b|sources sought/i },
  { m: "Notice of intent", where: "title", re: /^NOI\b|notice of intent/i },
];

type Input = Pick<Opportunity, "title" | "number" | "description" | "status"> & { fundingInstruments?: string[] };

export function classifyMechanisms(o: Input): Mechanism[] {
  const title = `${o.title} ${o.number ?? ""}`;
  const all = `${title}\n${(o.description ?? "").slice(0, 4000)}`;
  const out = new Set<Mechanism>();
  for (const r of RULES) if (r.re.test(r.where === "title" ? title : all)) out.add(r.m);
  if (o.status === "forecasted") out.add("Forecast");
  for (const code of o.fundingInstruments ?? []) out.add(INSTRUMENT[code] ?? "Other");
  // SBIR/STTR topics are usually listed as grants or contracts; keep both labels.
  return MECHANISMS.filter((m) => out.has(m));
}
