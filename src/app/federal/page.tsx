import Link from "next/link";
import { ScoreBadge, DeadlineChip } from "@/components/badges";
import { isHighMatch, isOpen, sortByFit } from "@/lib/dashboard";
import { agencyForCode, profile } from "@/lib/profile";
import { listOpportunities } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function FederalPage() {
  const open = (await listOpportunities()).filter((o) => isOpen(o));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Federal funding</h1>
        <p className="text-sm text-slate-500">
          Open opportunities at Forge’s priority agencies, from Grants.gov. Edit the agency list in <code>config/forge-profile.json</code>.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {profile.federalAgencies.map((agency) => {
          const items = sortByFit(open.filter((o) => agencyForCode(o.agencyCode)?.id === agency.id));
          return (
            <section key={agency.id} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-navy-900">{agency.name}</h2>
                <Link href={`/opportunities?agency=${agency.id}`} className="text-xs text-navy-700 hover:underline">
                  {items.length} open · {items.filter(isHighMatch).length} high match →
                </Link>
              </div>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  Nothing open in the database. Check the <a href={agency.url} target="_blank" rel="noreferrer" className="text-navy-700 underline">agency funding page ↗</a>.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {items.slice(0, 6).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-1.5">
                      <Link href={`/opportunities/${encodeURIComponent(o.id)}`} className="line-clamp-1 text-sm text-navy-800 hover:underline">{o.title}</Link>
                      <div className="flex shrink-0 items-center gap-2"><DeadlineChip iso={o.closeDate} /><ScoreBadge o={o} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
