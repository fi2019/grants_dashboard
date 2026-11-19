import Link from "next/link";
import { notFound } from "next/navigation";
import { DeadlineChip, ScoreBadge, SourceTag, StageBadge } from "@/components/badges";
import { DecisionPanel } from "@/components/decision-panel";
import { formatDate, formatMoney, formatRange } from "@/lib/dates";
import { getOpportunity } from "@/lib/store";

export const dynamic = "force-dynamic";

const STATUS_STYLE = {
  pass: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  fail: "bg-red-50 text-red-800 ring-red-200",
  unknown: "bg-slate-50 text-slate-600 ring-slate-200",
} as const;
const STATUS_TEXT = { pass: "Yes", fail: "No", unknown: "Not stated" } as const;

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOpportunity(decodeURIComponent(id));
  if (!o) notFound();
  const ev = o.evaluation;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div>
          <Link href="/opportunities" className="text-sm text-navy-700 hover:underline">← Opportunities</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <SourceTag source={o.source} /> <span>{o.agency}</span> {o.number && <span>· {o.number}</span>} <StageBadge stage={o.stage} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-navy-900">{o.title}</h1>
          {o.sourceUrl && (
            <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-navy-700 hover:underline">
              View the official listing ↗
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200 md:grid-cols-4">
          <Fact label="Fit"><ScoreBadge o={o} size="lg" /></Fact>
          <Fact label="Deadline"><DeadlineChip iso={o.closeDate} /></Fact>
          <Fact label="Award range">{formatRange(o.awardFloor, o.awardCeiling)}</Fact>
          <Fact label="Program total">{formatMoney(o.estimatedFunding)}{o.expectedAwards ? ` · ${o.expectedAwards} awards` : ""}</Fact>
        </div>

        {o.screening && o.screening.warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {o.screening.warnings.map((w) => <div key={w}>⚠ {w}</div>)}
          </div>
        )}

        {o.screening && (
          <Section title="Forge decision criteria">
            {o.screening.blockers.length > 0 && (
              <p className="mb-2 text-sm font-medium text-red-700">Blocker: {o.screening.blockers.join("; ")}</p>
            )}
            <div className="grid gap-2 md:grid-cols-2">
              {o.screening.criteria.map((c) => (
                <div key={c.id} className={`rounded p-2 text-sm ring-1 ${STATUS_STYLE[c.status]}`}>
                  <div className="font-medium">{c.label}: {STATUS_TEXT[c.status]}</div>
                  <div className="text-xs opacity-80">{c.evidence}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Automated checks from the listing text. Confirm against the full notice before deciding.
              {o.screening.signals.length > 0 && ` Profile signals: ${o.screening.signals.join(", ")}.`}
            </p>
          </Section>
        )}

        {ev ? (
          <>
            <Section title="Why it fits">{ev.whyItFits}</Section>
            {ev.proposedProject && <Section title="Proposed project">{ev.proposedProject}</Section>}
            <div className="grid gap-4 md:grid-cols-3">
              <Section title="Target clients">{ev.targetClients}</Section>
              <Section title="Recommended partners">
                <ol className="list-decimal space-y-1 pl-4">{ev.recommendedPartners.map((p) => <li key={p}>{p}</li>)}</ol>
              </Section>
              <Section title="Why Forge qualifies">{ev.whyForgeQualifies}</Section>
            </div>
            {ev.risks.length > 0 && (
              <Section title="Risks and open questions">
                <ul className="list-disc space-y-1 pl-4">{ev.risks.map((r) => <li key={r}>{r}</li>)}</ul>
              </Section>
            )}
            <p className="text-xs text-slate-400">Evaluated {formatDate(ev.evaluatedAt)} by {ev.model}. AI-generated; verify before relying on it.</p>
          </>
        ) : (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            Not yet evaluated by Claude. Use “Evaluate with Claude” to generate the fit analysis.
          </p>
        )}

        {o.eligibilityText && <Section title="Eligibility (from listing)"><Pre text={o.eligibilityText} /></Section>}
        {o.description && <Section title="Description (from listing)"><Pre text={o.description} /></Section>}
      </div>

      <aside className="no-print">
        <DecisionPanel
          id={o.id}
          stage={o.stage}
          owner={o.owner}
          notes={o.notes}
          internalReviewDate={o.internalReviewDate}
          hasEvaluation={Boolean(ev)}
        />
      </aside>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-break rounded-lg bg-white p-4 text-sm leading-relaxed shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-1.5 font-semibold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

function Pre({ text }: { text: string }) {
  return <div className="max-h-96 overflow-y-auto whitespace-pre-line text-slate-700">{text}</div>;
}
