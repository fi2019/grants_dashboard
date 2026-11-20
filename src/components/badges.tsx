import { daysUntil, formatDate, isImplausibleDeadline } from "@/lib/dates";
import { fitScore } from "@/lib/dashboard";
import { STAGE_LABELS, type Opportunity, type Stage } from "@/lib/types";

export function ScoreBadge({ o, size = "sm" }: { o: Opportunity; size?: "sm" | "lg" }) {
  const score = fitScore(o);
  if (score === null) return <span className="text-xs text-slate-400">—</span>;
  const color =
    score >= 8 ? "bg-emerald-700" : score >= 6 ? "bg-sky-700" : score >= 4 ? "bg-amber-600" : "bg-slate-400";
  const label = o.evaluation ? "Claude fit score" : "Keyword pre-score (not yet evaluated by Claude)";
  return (
    <span
      title={label}
      className={`inline-flex items-center rounded font-semibold text-white ${color} ${
        size === "lg" ? "px-3 py-1.5 text-xl" : "px-2 py-0.5 text-xs"
      } ${o.evaluation ? "" : "opacity-70 ring-1 ring-inset ring-white/40"}`}
    >
      {score}/10{o.evaluation ? "" : "*"}
    </span>
  );
}

export function DeadlineChip({ iso }: { iso: string | null }) {
  const d = daysUntil(iso);
  if (d === null) return <span className="text-xs text-slate-400">No deadline listed</span>;
  if (isImplausibleDeadline(iso))
    return <span className="text-xs text-amber-700" title="Likely placeholder in the source data">⚠ {formatDate(iso)} (check)</span>;
  // Red under a month, orange within three months, green beyond.
  const color = d < 0 ? "text-slate-400" : d < 30 ? "text-red-700" : d <= 90 ? "text-orange-600" : "text-emerald-700";
  return (
    <span className={`text-xs ${color}`}>
      {formatDate(iso)} · {d < 0 ? "closed" : d === 0 ? "today" : `${d}d left`}
    </span>
  );
}

const STAGE_COLOR: Record<Stage, string> = {
  new: "bg-slate-100 text-slate-700",
  screening: "bg-sky-100 text-sky-800",
  internal_review: "bg-violet-100 text-violet-800",
  go: "bg-emerald-100 text-emerald-800",
  drafting: "bg-emerald-100 text-emerald-800",
  submitted: "bg-indigo-100 text-indigo-800",
  awarded: "bg-emerald-600 text-white",
  not_awarded: "bg-slate-200 text-slate-600",
  declined: "bg-slate-200 text-slate-600",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STAGE_COLOR[stage]}`}>{STAGE_LABELS[stage]}</span>;
}

const ROLE = {
  lead: { text: "Forge can lead", cls: "bg-emerald-100 text-emerald-800" },
  partner: { text: "Partner role", cls: "bg-indigo-100 text-indigo-800" },
  either: { text: "Lead or partner", cls: "bg-emerald-100 text-emerald-800" },
  unclear: { text: "Lead: check notice", cls: "bg-slate-100 text-slate-600" },
} as const;

/** Forge's role: Claude's read when evaluated, otherwise the listing's eligibility rules. */
export function roleOf(o: Opportunity): keyof typeof ROLE | null {
  return o.evaluation?.forgeRole ?? o.screening?.leadRole ?? null;
}

export function RoleBadge({ o }: { o: Opportunity }) {
  const role = roleOf(o);
  if (!role) return null;
  const tip = o.evaluation?.roleRationale ?? o.screening?.leadReason ?? "";
  return <span title={tip} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ROLE[role].cls}`}>{ROLE[role].text}</span>;
}

export function SourceTag({ source }: { source: string }) {
  return <span className="rounded bg-navy-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">{source}</span>;
}
