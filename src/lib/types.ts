/** Where an opportunity came from. Add a value here when you add a source connector. */
export type SourceId = "grants.gov" | "sam.gov" | "manual";

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
  /** Hard blockers: if any are present the opportunity should not go to Claude. */
  blockers: string[];
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
  model: string;
  evaluatedAt: string;
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
