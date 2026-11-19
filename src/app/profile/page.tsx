import { profile } from "@/lib/profile";

export default function ProfilePage() {
  const list = (items: string[]) => <ul className="list-disc space-y-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
  const card = "rounded-lg bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Forge profile</h1>
        <p className="text-sm text-slate-500">
          This is what Claude and the keyword screen use to judge fit. Edit <code>config/forge-profile.json</code> and commit the change so edits are reviewed.
        </p>
      </div>
      <div className={card}><p className="leading-relaxed">{profile.summary}</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}><h2 className="mb-2 font-semibold text-navy-900">Capabilities</h2>{list(profile.capabilities)}</div>
        <div className={card}><h2 className="mb-2 font-semibold text-navy-900">Partners</h2>{list(profile.partners)}</div>
        <div className={card}><h2 className="mb-2 font-semibold text-navy-900">Good fit</h2>{list(profile.goodFit)}</div>
        <div className={card}><h2 className="mb-2 font-semibold text-navy-900">Poor fit</h2>{list(profile.poorFit)}</div>
        <div className={card}>
          <h2 className="mb-2 font-semibold text-navy-900">Search keywords (Grants.gov)</h2>
          <div className="flex flex-wrap gap-1.5">{profile.searchKeywords.map((k) => <span key={k} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{k}</span>)}</div>
        </div>
        <div className={card}>
          <h2 className="mb-2 font-semibold text-navy-900">Decision criteria</h2>
          {list([
            "501(c)(3) can be the lead applicant",
            "No cash match",
            "Indirect costs allowed",
            "Funds operating expenses",
            "Open solicitation (no invitation required)",
            `Internal review ${profile.internalReviewLeadDays} days before the deadline`,
          ])}
        </div>
      </div>
    </div>
  );
}
