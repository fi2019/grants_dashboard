import { OpportunityTable } from "@/components/opportunity-table";
import { fitScore, isOpen, sortByFit } from "@/lib/dashboard";
import { agencyForCode, profile } from "@/lib/profile";
import { listOpportunities } from "@/lib/store";
import { MECHANISMS } from "@/lib/screening/mechanism";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

type Search = { q?: string; min?: string; stage?: string; agency?: string; show?: string; criteria?: string; role?: string; type?: string };

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const all = await listOpportunities();
  const q = sp.q?.trim().toLowerCase();
  const min = Number(sp.min ?? 0);

  const items = sortByFit(
    all.filter((o) => {
      if (sp.show !== "all" && !sp.stage && !isOpen(o)) return false;
      if (sp.stage && o.stage !== sp.stage) return false;
      if (min && (fitScore(o) ?? 0) < min) return false;
      if (sp.agency && agencyForCode(o.agencyCode)?.id !== sp.agency) return false;
      if (sp.criteria === "clean" && o.screening?.criteria.some((c) => c.status === "fail" && c.id !== "lead_eligible")) return false;
      if (sp.type && !o.mechanisms?.includes(sp.type)) return false;
      if (sp.role && (o.evaluation?.forgeRole ?? o.screening?.leadRole) !== sp.role && !(sp.role === "lead" && o.evaluation?.forgeRole === "either")) return false;
      if (q && ![o.title, o.agency, o.number, o.description].some((f) => f?.toLowerCase().includes(q))) return false;
      return true;
    }),
  );

  const select = "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-900">Opportunities</h1>
      <form className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <input name="q" defaultValue={sp.q} placeholder="Search title, agency, number…" className={`${select} w-64`} />
        <select name="min" defaultValue={sp.min ?? ""} className={select}>
          <option value="">Any fit</option>
          <option value="8">Strong (8+)</option>
          <option value="6">Good (6+)</option>
          <option value="4">Possible (4+)</option>
        </select>
        <select name="agency" defaultValue={sp.agency ?? ""} className={select}>
          <option value="">All agencies</option>
          {profile.federalAgencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select name="stage" defaultValue={sp.stage ?? ""} className={select}>
          <option value="">Open stages</option>
          {STAGES.map((s: Stage) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className={select}>
          <option value="">Any type</option>
          {MECHANISMS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select name="role" defaultValue={sp.role ?? ""} className={select}>
          <option value="">Lead or partner</option>
          <option value="lead">Forge can lead</option>
          <option value="partner">Partner role only</option>
          <option value="unclear">Lead: check notice</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input type="checkbox" name="criteria" value="clean" defaultChecked={sp.criteria === "clean"} /> No failed criteria
        </label>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input type="checkbox" name="show" value="all" defaultChecked={sp.show === "all"} /> Include closed
        </label>
        <button className="rounded bg-navy-800 px-3 py-1.5 text-sm text-white">Filter</button>
        <span className="ml-auto text-xs text-slate-500">{items.length} shown · * = keyword pre-score, not yet evaluated by Claude</span>
      </form>
      <div className="flex gap-4 text-xs text-slate-500">
        <span>Criteria dots: no cash match · indirect costs · operating expenses · open solicitation. The role badge shows whether Forge can lead or would partner.</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> pass <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> fail <span className="inline-block h-2 w-2 rounded-full bg-slate-300" /> not stated</span>
      </div>
      <OpportunityTable items={items} empty="No opportunities match these filters." />
    </div>
  );
}
