/**
 * Add Assistance Listing numbers and past awards to stored opportunities
 * without a full rescan. Safe to re-run; refreshes awards older than a week.
 *   npm run enrich-awards                 (data/opportunities.json, else data/seed.json)
 *   npm run enrich-awards -- data/seed.json
 */
import { promises as fs } from "node:fs";
import { fetchDetails } from "../src/lib/sources/grants-gov.ts";
import { fetchPastAwards } from "../src/lib/sources/past-awards.ts";

const file = process.argv[2]
  ?? (await fs.access("data/opportunities.json").then(() => "data/opportunities.json", () => "data/seed.json"));
const db = JSON.parse(await fs.readFile(file, "utf8"));
const WEEK = 7 * 86_400_000;
const cache = new Map<string, Promise<unknown>>();
let withAwards = 0, failed = 0, i = 0;

for (const o of db.opportunities) {
  i++;
  if (!o.assistanceListings?.length && o.source === "grants.gov") {
    try { Object.assign(o, { assistanceListings: (await fetchDetails(o.id.split(":")[1])).assistanceListings ?? [] }); } catch { o.assistanceListings = []; }
  }
  if (o.pastAwards && Date.now() - Date.parse(o.pastAwards.fetchedAt) < WEEK) { if (o.pastAwards.awards.length) withAwards++; continue; }
  const key = (o.agencyCode ?? "").startsWith("NSF") ? `nsf:${o.title}` : `al:${(o.assistanceListings ?? []).join(",")}`;
  if (!cache.has(key)) cache.set(key, fetchPastAwards(o).catch(() => { failed++; return null; }));
  o.pastAwards = await cache.get(key);
  if (o.pastAwards?.awards.length) withAwards++;
  if (i % 50 === 0) console.log(`${i}/${db.opportunities.length}`);
}
await fs.writeFile(file, JSON.stringify(db, null, 1));
console.log(`Done: ${withAwards} of ${db.opportunities.length} opportunities have past awards; ${failed} lookups failed.`);
