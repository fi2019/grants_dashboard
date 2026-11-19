import Link from "next/link";
import { DeadlineChip, ScoreBadge } from "@/components/badges";
import { daysUntil, formatDate } from "@/lib/dates";
import { listOpportunities } from "@/lib/store";
import { STAGE_LABELS, type Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLUMNS: Stage[] = ["screening", "internal_review", "go", "drafting", "submitted"];

export default async function PipelinePage() {
  const all = await listOpportunities();
  const active = all.filter((o) => COLUMNS.includes(o.stage) && (o.stage === "submitted" || (daysUntil(o.closeDate) ?? 0) >= 0));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Pipeline</h1>
        <p className="text-sm text-slate-500">Move opportunities between stages from their detail page. “New” and “No-go” are on the Opportunities page.</p>
      </div>
      <div className="grid gap-3 overflow-x-auto md:grid-cols-5">
        {COLUMNS.map((col) => {
          const cards = active
            .filter((o) => o.stage === col)
            .sort((a, b) => Date.parse(a.closeDate ?? "9999") - Date.parse(b.closeDate ?? "9999"));
          return (
            <div key={col} className="min-w-56 rounded-lg bg-slate-200/60 p-2">
              <h2 className="mb-2 px-1 text-sm font-semibold text-navy-900">{STAGE_LABELS[col]} <span className="text-slate-500">{cards.length}</span></h2>
              <div className="space-y-2">
                {cards.map((o) => (
                  <Link key={o.id} href={`/opportunities/${encodeURIComponent(o.id)}`} className="block rounded bg-white p-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-navy-700">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-3 text-sm font-medium text-navy-800">{o.title}</span>
                      <ScoreBadge o={o} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{o.agency}</div>
                    <div className="mt-1"><DeadlineChip iso={o.closeDate} /></div>
                    {o.internalReviewDate && <div className="text-xs text-violet-700">Forge internal: {formatDate(o.internalReviewDate)}</div>}
                    {o.owner && <div className="text-xs text-slate-500">Owner: {o.owner}</div>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
