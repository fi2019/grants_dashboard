import Link from "next/link";
import { DeadlineChip, ScoreBadge } from "@/components/badges";
import { OpportunityTable } from "@/components/opportunity-table";
import { ScanButton } from "@/components/scan-button";
import { computeStats, isHighMatch, isOpen, sortByFit } from "@/lib/dashboard";
import { formatDate } from "@/lib/dates";
import { getLastScan, listOpportunities } from "@/lib/store";
import { STAGE_LABELS, type Opportunity, type Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [all, lastScan] = await Promise.all([listOpportunities(), getLastScan()]);
  const stats = computeStats(all);
  const top = sortByFit(all.filter((o) => isOpen(o) && isHighMatch(o))).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Grant dashboard</h1>
          <p className="text-sm text-slate-500">
            {lastScan ? `Last scan ${formatDate(lastScan.finishedAt)}: ${lastScan.fetched} fetched, ${lastScan.added} new, ${lastScan.evaluated} evaluated by Claude` : "No scans yet"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/opportunities" className="flex">
            <input name="q" placeholder="Search opportunities…" className="w-64 rounded-l border border-slate-300 bg-white px-3 py-2 text-sm" />
            <button className="rounded-r bg-navy-800 px-3 text-sm text-white">Search</button>
          </form>
          <ScanButton />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open opportunities" value={stats.open} sub={`${stats.newThisWeek} new this week`} href="/opportunities" />
        <Stat label="High match (6+)" value={stats.highMatch} sub={`${stats.highMatchNew} new this week`} href="/opportunities?min=6" accent />
        <Stat label="Internal review due (14d)" value={stats.internalReviewDue.length} sub="Go/no-go decisions to make" href="/pipeline" />
        <Stat label="Submission deadlines (30d)" value={stats.submissionDeadlines.length} sub="High match or in progress" href="/pipeline" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DueList title="Internal review due" items={stats.internalReviewDue} dateOf={(o) => o.internalReviewDate} empty="No go/no-go reviews due in the next 14 days." />
        <DueList title="Submission deadlines" items={stats.submissionDeadlines} dateOf={(o) => o.closeDate} empty="No high-match deadlines in the next 30 days." />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Top recommended</h2>
          <Link href="/opportunities?min=6" className="text-sm text-navy-700 hover:underline">All high matches →</Link>
        </div>
        <OpportunityTable items={top} empty="No Claude-evaluated high matches yet. Run a scan with ANTHROPIC_API_KEY set." />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-navy-900">Decision funnel</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(stats.byStage) as Stage[]).map((s) => (
            <Link key={s} href={`/opportunities?stage=${s}`} className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-navy-700">
              <span className="font-semibold text-navy-900">{stats.byStage[s]}</span> <span className="text-slate-500">{STAGE_LABELS[s]}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, href, accent }: { label: string; value: number; sub: string; href: string; accent?: boolean }) {
  return (
    <Link href={href} className={`rounded-lg p-4 shadow-sm ring-1 ${accent ? "bg-navy-900 text-white ring-navy-900" : "bg-white ring-slate-200"} hover:ring-navy-700`}>
      <div className={`text-xs uppercase tracking-wide ${accent ? "text-white/70" : "text-slate-500"}`}>{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      <div className={`text-xs ${accent ? "text-white/70" : "text-slate-500"}`}>{sub}</div>
    </Link>
  );
}

function DueList({ title, items, dateOf, empty }: { title: string; items: Opportunity[]; dateOf: (o: Opportunity) => string | null; empty: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="mb-2 font-semibold text-navy-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 8).map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2">
              <Link href={`/opportunities/${encodeURIComponent(o.id)}`} className="line-clamp-1 text-sm text-navy-800 hover:underline">{o.title}</Link>
              <div className="flex shrink-0 items-center gap-2"><DeadlineChip iso={dateOf(o)} /><ScoreBadge o={o} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
