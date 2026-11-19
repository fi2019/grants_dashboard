import { daysUntil } from "./dates";
import type { Opportunity, Stage } from "./types";

const OPEN_STAGES: Stage[] = ["new", "screening", "internal_review", "go", "drafting"];

export function isOpen(o: Opportunity, now = new Date()): boolean {
  const d = daysUntil(o.closeDate, now);
  return OPEN_STAGES.includes(o.stage) && (d === null || d >= 0);
}

/** Best available fit on a 1-10 scale: Claude's score, else pre-score / 10. */
export function fitScore(o: Opportunity): number | null {
  if (o.evaluation) return o.evaluation.score;
  if (o.screening) return Math.max(1, Math.round(o.screening.preScore / 10));
  return null;
}

export function isHighMatch(o: Opportunity): boolean {
  return (o.evaluation?.score ?? 0) >= 6;
}

export interface DashboardStats {
  open: number;
  newThisWeek: number;
  highMatch: number;
  highMatchNew: number;
  internalReviewDue: Opportunity[];
  submissionDeadlines: Opportunity[];
  byStage: Record<Stage, number>;
}

export function computeStats(all: Opportunity[], now = new Date()): DashboardStats {
  const open = all.filter((o) => isOpen(o, now));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const isNew = (o: Opportunity) => Date.parse(o.fetchedAt) >= weekAgo;
  const within = (iso: string | null, days: number) => {
    const d = daysUntil(iso, now);
    return d !== null && d >= 0 && d <= days;
  };
  const byStage = Object.fromEntries(
    ["new", "screening", "internal_review", "go", "drafting", "submitted", "awarded", "not_awarded", "declined"].map((s) => [s, 0]),
  ) as Record<Stage, number>;
  for (const o of all) byStage[o.stage]++;

  return {
    open: open.length,
    newThisWeek: open.filter(isNew).length,
    highMatch: open.filter(isHighMatch).length,
    highMatchNew: open.filter((o) => isHighMatch(o) && isNew(o)).length,
    internalReviewDue: open
      .filter((o) => ["screening", "internal_review"].includes(o.stage) && within(o.internalReviewDate, 14))
      .sort((a, b) => Date.parse(a.internalReviewDate!) - Date.parse(b.internalReviewDate!)),
    submissionDeadlines: open
      .filter((o) => within(o.closeDate, 30) && (isHighMatch(o) || ["internal_review", "go", "drafting"].includes(o.stage)))
      .sort((a, b) => Date.parse(a.closeDate!) - Date.parse(b.closeDate!)),
    byStage,
  };
}

export function sortByFit(list: Opportunity[]): Opportunity[] {
  return [...list].sort((a, b) => (fitScore(b) ?? 0) - (fitScore(a) ?? 0) || (Date.parse(a.closeDate ?? "9999") - Date.parse(b.closeDate ?? "9999")));
}
