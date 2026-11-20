import { isImplausibleDeadline } from "../dates";
import type { CriterionResult, Opportunity, Screening } from "../types";

type ScreenInput = Pick<
  Opportunity,
  "title" | "description" | "eligibilityText" | "costSharing" | "closeDate" | "agency"
>;

/**
 * Topic signals from the Forge profile. Weights are a starting point; tune them
 * against decisions the team actually makes (see README "Refining the scoring").
 */
const SIGNALS: { label: string; weight: number; pattern: RegExp }[] = [
  { label: "Cybersecurity", weight: 12, pattern: /cyber ?security|information security|cyber\b/i },
  { label: "Critical infrastructure", weight: 10, pattern: /critical infrastructure|ceser|energy security|grid (security|resilience)/i },
  { label: "OT/ICS", weight: 10, pattern: /operational technology|industrial control|\bICS\b|SCADA/i },
  { label: "Utilities", weight: 12, pattern: /rural (electric|utilit)|municipal (electric|utilit)|electric cooperative|electric utilit/i },
  { label: "Workforce", weight: 10, pattern: /workforce|apprenticeship|job training|upskill|training program/i },
  { label: "AI / data", weight: 8, pattern: /artificial intelligence|\bAI\b|machine learning|data analytics/i },
  { label: "Tech transfer", weight: 8, pattern: /technology transfer|commerciali[sz]ation|tech(nology)? transition|testbed|demonstration/i },
  { label: "Accelerator", weight: 7, pattern: /accelerator|incubator|entrepreneur|startup/i },
  { label: "Intermediary / TA", weight: 10, pattern: /intermediar|technical assistance|consortium|coordinat(or|ion) hub|regional hub/i },
  { label: "Partnership", weight: 6, pattern: /public[- ]private|cross[- ]sector|partnership|information sharing|\bISAC\b/i },
  { label: "Energy", weight: 6, pattern: /\benergy\b|electric|grid\b|power sector/i },
  { label: "Innovation", weight: 4, pattern: /innovation/i },
];

const OFF_TOPIC: { label: string; weight: number; pattern: RegExp }[] = [
  { label: "Construction / facilities", weight: 15, pattern: /construction|renovation|janitorial|landscaping|vessel/i },
  { label: "Basic science", weight: 10, pattern: /astronom|genom|neuroscience|linguistic|anthropolog|oceanograph|arctic|antarctic|plant biolog/i },
  { label: "Individual fellowship", weight: 15, pattern: /postdoctoral|fellowship|dissertation|early[- ]career faculty|CAREER\b/i },
];

/**
 * Rules that stop Forge from being the LEAD applicant. Forge does not have to
 * lead: these opportunities stay in play with Forge as a partner, subrecipient
 * or subcontractor to an eligible lead (a university, lab or small business).
 */
const LEAD_RESTRICTIONS: { reason: string; pattern: RegExp }[] = [
  { reason: "Only institutions of higher education may apply", pattern: /(only|exclusively|restricted to)[^.]{0,60}institutions of higher education/i },
  { reason: "Requires a tenured or tenure-track PI", pattern: /tenure[- ]track|tenured faculty/i },
  { reason: "Nonprofits are not eligible to apply directly", pattern: /nonprofits? (are|is) not eligible|for[- ]profit (entities )?only/i },
  { reason: "SBIR/STTR: a small business must be the applicant", pattern: /\bSBIR\b|\bSTTR\b|small business innovation research/i },
  { reason: "Restricted to HBCUs / tribal institutions", pattern: /only[^.]{0,40}(HBCU|historically black|tribal colleges)/i },
];

/** Rules that rule out Forge in any role. */
const BLOCKERS: { reason: string; pattern: RegExp }[] = [
  { reason: "Invitation only", pattern: /by invitation only|invitation[- ]only|invited applicants only/i },
];

function textOf(o: ScreenInput): string {
  return [o.title, o.description, o.eligibilityText].filter(Boolean).join("\n");
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern);
  if (!m || m.index === undefined) return null;
  const start = Math.max(0, m.index - 40);
  return `…${text.slice(start, m.index + m[0].length + 60).replace(/\s+/g, " ").trim()}…`;
}

export function evaluateCriteria(o: ScreenInput): CriterionResult[] {
  const text = textOf(o);
  const elig = o.eligibilityText ?? "";

  const nonprofitOk =
    /nonprofits?( organizations)?|501\s*\(c\)\s*\(3\)|unrestricted/i;
  const leadBlocked = LEAD_RESTRICTIONS.find((b) => b.pattern.test(text));
  const label = "Forge can lead";
  const lead: CriterionResult = leadBlocked
    ? { id: "lead_eligible", label, status: "fail", evidence: `${leadBlocked.reason}. Forge can still join as a partner or subrecipient.` }
    : nonprofitOk.test(elig)
      ? { id: "lead_eligible", label, status: "pass", evidence: firstMatch(elig, nonprofitOk) ?? "Nonprofits listed as eligible" }
      : { id: "lead_eligible", label, status: "unknown", evidence: "Eligibility not stated in the listing. Check the full notice; Forge can partner either way." };

  const matchRequired = /cost[- ]shar(e|ing) (is )?required|matching funds (are )?required|non-federal match of|\d+% (cash )?match/i;
  const noMatch = /no (cash )?match|cost[- ]sharing is not required|no cost[- ]share|matching funds (are )?not required/i;
  const match: CriterionResult =
    o.costSharing === true || matchRequired.test(text)
      ? { id: "no_cash_match", label: "No cash match", status: "fail", evidence: firstMatch(text, matchRequired) ?? "Listing says cost sharing is required" }
      : o.costSharing === false || noMatch.test(text)
        ? { id: "no_cash_match", label: "No cash match", status: "pass", evidence: firstMatch(text, noMatch) ?? "Listing says cost sharing is not required" }
        : { id: "no_cash_match", label: "No cash match", status: "unknown", evidence: "Cost-share requirement not stated." };

  const idcNo = /indirect costs? (are )?not allowed|no indirect costs?|indirect costs? (are )?unallowable/i;
  const idcYes = /indirect costs?|facilities and administrative|F&A|negotiated indirect|de minimis/i;
  const idc: CriterionResult = idcNo.test(text)
    ? { id: "indirect_costs", label: "Indirect costs allowed", status: "fail", evidence: firstMatch(text, idcNo)! }
    : idcYes.test(text)
      ? { id: "indirect_costs", label: "Indirect costs allowed", status: "pass", evidence: firstMatch(text, idcYes)! }
      : { id: "indirect_costs", label: "Indirect costs allowed", status: "unknown", evidence: "Not stated. Most federal grants allow indirect costs under 2 CFR 200; confirm in the notice." };

  const opexNo = /operating (costs|expenses) (are )?(not allowed|unallowable)|may not be used for (general )?operating/i;
  const opexYes = /operating (costs|expenses|support)|personnel costs|salar(y|ies)|general operating/i;
  const opex: CriterionResult = opexNo.test(text)
    ? { id: "operating_expenses", label: "Funds operating expenses", status: "fail", evidence: firstMatch(text, opexNo)! }
    : opexYes.test(text)
      ? { id: "operating_expenses", label: "Funds operating expenses", status: "pass", evidence: firstMatch(text, opexYes)! }
      : { id: "operating_expenses", label: "Funds operating expenses", status: "unknown", evidence: "Not stated in the listing." };

  const inviteOnly = /by invitation only|invitation[- ]only|invited applicants only|closed solicitation/i;
  const open: CriterionResult = inviteOnly.test(text)
    ? { id: "open_solicitation", label: "Open solicitation", status: "fail", evidence: firstMatch(text, inviteOnly)! }
    : { id: "open_solicitation", label: "Open solicitation", status: "pass", evidence: "No invitation requirement found." };

  return [lead, match, idc, opex, open];
}

export function screen(o: ScreenInput): Screening {
  const text = textOf(o);
  const signals = SIGNALS.filter((s) => s.pattern.test(text));
  const offTopic = OFF_TOPIC.filter((s) => s.pattern.test(text));
  const criteria = evaluateCriteria(o);

  let score = 20;
  for (const s of signals) score += s.weight;
  for (const s of offTopic) score -= s.weight;
  for (const c of criteria) {
    if (c.status === "pass") score += 3;
    // Not being able to lead is not a penalty: Forge can partner.
    if (c.status === "fail" && c.id !== "lead_eligible") score -= 10;
  }

  const blockers = BLOCKERS.filter((b) => b.pattern.test(text)).map((b) => b.reason);
  const leadCrit = criteria[0];
  const leadRole: Screening["leadRole"] = leadCrit.status === "pass" ? "lead" : leadCrit.status === "fail" ? "partner" : "unclear";
  const warnings: string[] = [];
  if (isImplausibleDeadline(o.closeDate)) warnings.push("Deadline is more than 5 years out; likely placeholder data in the source.");
  if (!o.description) warnings.push("No description in the listing; scoring used the title only.");

  return {
    preScore: Math.max(0, Math.min(100, score)),
    signals: signals.map((s) => s.label),
    criteria,
    blockers,
    warnings,
    leadRole,
    leadReason: leadCrit.evidence,
  };
}
