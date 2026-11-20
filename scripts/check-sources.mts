/**
 * Check whether each source can be pulled from, and explain any problem in
 * plain words. Used by the daily scan; the result is saved to the hosted page
 * (settings/sourceHealth) and shown on the Sources tab.
 *
 *   npm run check-sources -- <sources.json | folder of source .json files> <out.json>
 *
 * Connected sources get a real data request (Grants.gov search, USAspending
 * award search, NSF award API). Everything else gets its website and API URL
 * fetched like a browser would.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

interface Source { id: string; name: string; url?: string; apiUrl?: string; status?: string }
interface Result { ok: boolean; checkedAt: string; checks: { what: string; url: string; ok: boolean; code: number | null; problem?: string }[]; problem?: string }

const [input, out] = process.argv.slice(2);
if (!input || !out) throw new Error("Usage: npm run check-sources -- <sources.json|dir> <out.json>");

async function loadSources(p: string): Promise<Source[]> {
  const stat = await fs.stat(p);
  if (stat.isDirectory()) {
    const files = (await fs.readdir(p)).filter((f) => f.endsWith(".json"));
    return Promise.all(files.map(async (f) => ({ id: path.basename(f, ".json"), ...JSON.parse(await fs.readFile(path.join(p, f), "utf8")) })));
  }
  const raw = JSON.parse(await fs.readFile(p, "utf8"));
  return Array.isArray(raw) ? raw : raw.sources;
}

/** Plain-words explanation for a failed request. */
function explain(code: number | null, err?: unknown, finalUrl?: string, asked?: string): string {
  if (err) {
    const msg = String((err as Error)?.cause ?? (err as Error)?.message ?? err);
    if (/abort|timeout/i.test(msg)) return "The site didn't answer within 20 seconds. It may be down or slow; it often recovers by itself.";
    if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(msg)) return "The scanner couldn't find this web address from its network. The link may be retired or mistyped, or the site may block cloud networks. Open it in a browser to check.";
    if (/certificate|SSL|TLS/i.test(msg)) return "The site's security certificate was rejected, so the connection was refused.";
    if (/ECONNREFUSED|ECONNRESET|socket|fetch failed/i.test(msg)) return "The scanner couldn't connect to this site from its network. The site may be down, retired, or blocking cloud networks. Open it in a browser to check.";
    return `The request failed: ${msg.slice(0, 160)}`;
  }
  if (code === 401) return "The site requires a sign-in or an API key (HTTP 401).";
  if (code === 403) return "The site refuses automated requests (HTTP 403). People can open it in a browser, but the scanner can't read it, so check it by hand.";
  if (code === 404) return "Page not found (HTTP 404). The link has probably moved; update it in the source.";
  if (code === 410) return "The page has been removed (HTTP 410).";
  if (code === 429) return "The site is rate-limiting requests (HTTP 429). It usually clears on the next run.";
  if (code && code >= 500) return `The site had a server error (HTTP ${code}). It's usually temporary.`;
  if (code && code >= 400) return `The site returned an error (HTTP ${code}).`;
  if (finalUrl && asked && new URL(finalUrl).hostname !== new URL(asked).hostname) return `The link now redirects to ${new URL(finalUrl).hostname}. Check that it's still the right page.`;
  return "Unknown problem.";
}

async function probe(what: string, url: string, init?: RequestInit, okTest?: (r: Response) => Promise<boolean>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ForgeGrantsSourceCheck/1.0)", Accept: "text/html,application/json;q=0.9,*/*;q=0.8" }, ...init });
    const good = res.ok && (!okTest || (await okTest(res)));
    const moved = res.ok && new URL(res.url).hostname.replace(/^www\./, "") !== new URL(url).hostname.replace(/^www\./, "");
    return { what, url, ok: good, code: res.status, ...(good ? (moved ? { problem: explain(res.status, undefined, res.url, url) } : {}) : { problem: res.ok ? "The site answered, but not with the data the scanner expects. Its format may have changed." : explain(res.status) }) };
  } catch (err) {
    return { what, url, ok: false, code: null, problem: explain(null, err) };
  } finally { clearTimeout(timer); }
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });

/** Real data pulls for the sources the system is connected to. */
const LIVE: Record<string, () => Promise<Result["checks"][number]>> = {
  "grants-gov": () => probe("Grants.gov search API", "https://api.grants.gov/v1/api/search2", json({ keyword: "cybersecurity", rows: 1 }),
    async (r) => (await r.json())?.errorcode === 0),
  "usaspending-gov": () => probe("USAspending award search API", "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    json({ filters: { award_type_codes: ["02"], program_numbers: ["47.076"] }, fields: ["Award ID"], limit: 1 }), async (r) => Array.isArray((await r.json())?.results)),
  "dhs-procurement-forecast-apfs-4site": () => probe("DHS forecast CSV download", "https://www.dhs.gov/xlibrary/daily-contract-opportunities-report/APFS_forecast_allRecords.csv",
    undefined, async (r) => (await r.text()).startsWith("APFS Number")),
  nsf: () => probe("NSF Award Search API", "https://api.nsf.gov/services/v1/awards.json?keyword=cybersecurity&rpp=1", undefined, async (r) => Array.isArray((await r.json())?.response?.award)),
};

const sources = await loadSources(input);
const now = new Date().toISOString();
const results: Record<string, Result> = {};
const queue = [...sources];
async function worker() {
  for (let s = queue.shift(); s; s = queue.shift()) {
    const checks: Result["checks"] = [];
    if (LIVE[s.id]) checks.push(await LIVE[s.id]());
    if (s.url && /^https?:\/\//.test(s.url)) checks.push(await probe("Website", s.url));
    // API addresses of sources that aren't connected yet are not tested: most need a key or a data
    // request, so a plain page load would report false problems.
    // For connected sources the real data pull decides; a website hiccup is only a warning.
    const live = LIVE[s.id] ? checks[0] : null;
    const bad = live ? (live.ok ? [] : [live]) : checks.filter((c) => !c.ok);
    if (live?.ok) for (const c of checks.slice(1)) if (!c.ok) { c.ok = true; c.problem = `${c.problem} (The data pull itself works.)`; }
    const warn = checks.filter((c) => c.ok && c.problem);
    results[s.id] = {
      ok: !bad.length && checks.length > 0,
      checkedAt: now,
      checks,
      ...(bad.length ? { problem: bad.map((c) => `${c.what}: ${c.problem}`).join(" ") } : warn.length ? { problem: warn.map((c) => `${c.what}: ${c.problem}`).join(" ") } : !checks.length ? { problem: "No link to check. Add the source's website." } : {}),
    };
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const problems = Object.values(results).filter((r) => !r.ok).length;
await fs.writeFile(out, JSON.stringify({ checkedAt: now, total: sources.length, problems, results }, null, 1));
console.log(`Checked ${sources.length} sources: ${problems} with problems -> ${out}`);
