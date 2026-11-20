import Link from "next/link";
import { formatMoney } from "@/lib/dates";
import type { Opportunity } from "@/lib/types";
import { DeadlineChip, MechanismBadges, RoleBadge, ScoreBadge, SourceTag, StageBadge } from "./badges";

export function OpportunityTable({ items, empty = "Nothing here yet." }: { items: Opportunity[]; empty?: string }) {
  if (!items.length) return <p className="rounded-lg bg-white p-6 text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Fit</th>
            <th className="px-3 py-2">Opportunity</th>
            <th className="px-3 py-2">Deadline</th>
            <th className="px-3 py-2">Award ceiling</th>
            <th className="px-3 py-2">Criteria</th>
            <th className="px-3 py-2">Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((o) => (
            <tr key={o.id} className="align-top hover:bg-slate-50">
              <td className="px-3 py-2"><ScoreBadge o={o} /></td>
              <td className="max-w-xl px-3 py-2">
                <Link href={`/opportunities/${encodeURIComponent(o.id)}`} className="font-medium text-navy-800 hover:underline">
                  {o.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <SourceTag source={o.source} />
                  <MechanismBadges o={o} />
                  <RoleBadge o={o} />
                  <span>{o.agency}</span>
                  {o.number && <span>· {o.number}</span>}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2"><DeadlineChip iso={o.closeDate} /></td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatMoney(o.awardCeiling)}</td>
              <td className="px-3 py-2"><CriteriaDots o={o} /></td>
              <td className="px-3 py-2"><StageBadge stage={o.stage} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DOT = { pass: "bg-emerald-500", fail: "bg-red-500", unknown: "bg-slate-300" } as const;

export function CriteriaDots({ o }: { o: Opportunity }) {
  if (!o.screening) return null;
  return (
    <div className="flex gap-1">
      {o.screening.criteria.filter((c) => c.id !== "lead_eligible").map((c) => (
        <span key={c.id} title={`${c.label}: ${c.status}`} className={`h-2.5 w-2.5 rounded-full ${DOT[c.status]}`} />
      ))}
    </div>
  );
}
