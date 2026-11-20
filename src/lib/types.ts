/** Where an opportunity came from. Add a value here when you add a source connector. */
export type SourceId = "grants.gov" | "dhs-apfs" | "sam.gov" | "manual";

/**
 * Decision pipeline. Each opportunity moves left to right; "declined" and
 * "not_awarded" are terminal.
 */
export const STAGES = [
  "new",
  "screening",
  "internal_review",
  "go",
  "drafting",
  "submitted",
  "awarded",
  "not_awarded",
  "declined",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  screening: "Screening",
  internal_review: "Internal review",
  go: "Go",
  drafting: "Drafting",
  submitted: "Submitted",
  awarded: "Awarded",
  not_awarded: "Not awarded",
  declined: "No-go",
};

/** Result of one deterministic decision criterion. "unknown" means the notice did not say. */
export type CriterionStatus = "pass" | "fail" | "unknown";

export interface CriterionResult {
  id: "lead_eligible" | "no_cash_match" | "indirect_costs" | "operating_expenses" | "open_solicitation";
  label: string;
  status: CriterionStatus;
  evidence: string;
}

export interface Screening {
  /** 0-100 keyword/criteria score computed without an LLM. */
  preScore: number;
  /** Signals from the Forge profile that matched, e.g. "OT/ICS". */
  signals: string[];
  criteria: CriterionResult[];
  /** Hard blockers that rule Forge out in any role (e.g. invitation only). */
  blockers: string[];
  /**
   * Whether Forge can be the lead applicant. Forge does not have to lead:
   * "partner" means Forge joins an eligible lead as partner or subrecipient.
   */
  leadRole: "lead" | "partner" | "unclear";
  leadReason: string;
  /** Data quality warnings, e.g. an implausible deadline. */
  warnings: string[];
}

/** Claude's evaluation, mirroring the sections of the sample grant report. */
export interface Evaluation {
  /** 1-10, same scale as the sample report. */
  score: number;
  tier: "strong" | "good" | "possible" | "poor";
  whyItFits: string;
  proposedProject: string;
  targetClients: string;
  recommendedPartners: string[];
  whyForgeQualifies: string;
  risks: string[];
  /** Claude's read of Forge's role: lead applicant, partner/subrecipient, or either. */
  forgeRole?: "lead" | "partner" | "either";
  roleRationale?: string;
  model: string;
  evaluatedAt: string;
}

/** A previously funded award under the same program, from a public award database. */
export interface PastAward {
  id: string;
  title: string;
  recipient: string | null;
  amount: number | null;
  startDate: string | null;
  program: string | null;
  /** Public award record (NSF award page or USAspending award page). */
  url: string;
  /** Project abstract when the source publishes one (NSF), trimmed. */
  abstract: string | null;
}

export interface PastAwards {
  source: "NSF Award Search" | "USAspending.gov";
  /** How the awards were matched, in plain words, including caveats. */
  method: string;
  /** Link to the full search on the source site. */
  searchUrl: string;
  awards: PastAward[];
  fetchedAt: string;
}

export interface Opportunity {
  /** Stable id, prefixed by source: "grants.gov:361238". */
  id: string;
  source: SourceId;
  sourceUrl: string | null;
  number: string | null;
  title: string;
  agency: string | null;
  agencyCode: string | null;
  description: string | null;
  eligibilityText: string | null;
  /** Grants.gov funding-instrument codes: G grant, CA cooperative agreement, PC procurement contract, O other. */
  fundingInstruments?: string[];
  /** Funding vehicle labels, e.g. ["SBIR", "Grant"]. See screening/mechanism.ts. */
  mechanisms?: string[];
  /** Assistance Listing (CFDA) numbers, e.g. ["47.076"]. */
  assistanceListings?: string[];
  pastAwards?: PastAwards | null;
  /** grants.gov: "True"/"False"; null when the source does not say. */
  costSharing: boolean | null;
  awardFloor: number | null;
  awardCeiling: number | null;
  estimatedFunding: number | null;
  expectedAwards: number | null;
  postedDate: string | null;
  /** Submission deadline (ISO). */
  closeDate: string | null;
  status: "posted" | "forecasted" | "closed" | "unknown";
  fetchedAt: string;

  screening: Screening | null;
  evaluation: Evaluation | null;

  /** Forge's own decision tracking. */
  stage: Stage;
  /** Internal go/no-go review date (ISO). Defaults to closeDate minus internalReviewLeadDays. */
  internalReviewDate: string | null;
  owner: string | null;
  notes: string;
  updatedAt: string;
}
