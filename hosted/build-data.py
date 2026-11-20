"""Build the hosted page's data files from the app's database.

    python3 hosted/build-data.py [data/opportunities.json] [out_dir]

Writes opportunities.json and meta.json next to hosted/index.html; then
republish the page (with those two files) to the same claude.ai artifact URL.
Shared go/no-go decisions live in the artifact's own store and are untouched.
"""
import json, sys, os

src = sys.argv[1] if len(sys.argv) > 1 else ("data/opportunities.json" if os.path.exists("data/opportunities.json") else "data/seed.json")
out = sys.argv[2] if len(sys.argv) > 2 else "hosted"
db = json.load(open(src))
rows = []
for o in db["opportunities"]:
    sc = o.get("screening") or {}
    rows.append(dict(
        # Page ids: "gg-361238" for Grants.gov (kept for existing decisions and ratings), "dhs-F2026074886" for the DHS forecast.
        id=("gg-" if o["source"] == "grants.gov" else o["source"].split("-")[0] + "-") + o["id"].split(":", 1)[1], source=o["source"], url=o["sourceUrl"], number=o["number"], title=o["title"], agency=o["agency"],
        agencyCode=o["agencyCode"], description=(o["description"] or "")[:3500] or None,
        eligibility=(o["eligibilityText"] or "")[:2500] or None, costSharing=o["costSharing"], awardFloor=o["awardFloor"],
        awardCeiling=o["awardCeiling"], estimatedFunding=o["estimatedFunding"], expectedAwards=o["expectedAwards"],
        postedDate=o["postedDate"], closeDate=o["closeDate"], status=o["status"], fetchedAt=o["fetchedAt"],
        preScore=sc.get("preScore"), signals=sc.get("signals", []),
        criteria=[{k: c[k] for k in ("id", "label", "status", "evidence")} for c in sc.get("criteria", [])],
        blockers=sc.get("blockers", []), warnings=sc.get("warnings", []),
        leadRole=sc.get("leadRole", "unclear"), leadReason=sc.get("leadReason", ""),
        assistanceListings=o.get("assistanceListings") or [], pastAwards=o.get("pastAwards"), mechanisms=o.get("mechanisms") or [], evaluation=o["evaluation"], defaultStage=o["stage"]))
with open(os.path.join(out, "opportunities.json"), "w") as f:
    f.write("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n")
scan = db.get("lastScan") or {}
json.dump(dict(snapshotAt=scan.get("finishedAt"), bySource=scan.get("bySource", {}),
               profile=json.load(open("config/forge-profile.json"))), open(os.path.join(out, "meta.json"), "w"), indent=1)
print(f"{len(rows)} opportunities -> {out}/")
