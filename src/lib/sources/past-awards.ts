/**
 * Past awards for an opportunity, from public award databases (no keys needed):
 *  - NSF Award Search API (https://www.nsf.gov/developer/) for NSF programs. Includes
 *    each funded project's abstract, the closest public stand-in for a winning proposal.
 *  - USAspending.gov (https://api.usaspending.gov/) for everything else, matched on the
 *    opportunity's Assistance Listing (CFDA) number.
 * Full proposals are not public; links go to each award's public record.
 */
import type { Opportunity, PastAward, PastAwards } from "../types";

const USASPENDING = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const NSF_API = "https://api.nsf.gov/services/v1/awards.json";
const YEARS_BACK = 6;

function sinceDate(years = YEARS_BACK): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}

/** "Cybersecurity Innovation for Cyberinfrastructure (CICI)" -> "CICI". */
export function programAcronym(title: string): string | null {
  const m = title.match(/\(([A-Z][A-Za-z0-9&:\- ]{1,24})\)\s*$/) ?? title.match(/\(([A-Z]{2,}[A-Za-z0-9&\-]*)\)/);
  return m ? m[1].trim().replace(/^NSF\s+/i, "") : null;
}

async function json<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface NsfAward {
  id: string;
  title: string;
  awardeeName?: string;
  estimatedTotalAmt?: string;
  startDate?: string; // MM/DD/YYYY
  fundProgramName?: string;
  abstractText?: string;
}

const mdY = (s?: string) => {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

async function nsfQuery(params: Record<string, string>): Promise<NsfAward[]> {
  const since = sinceDate();
  const q = new URLSearchParams({
    ...params,
    dateStart: `${String(since.getUTCMonth() + 1).padStart(2, "0")}/${String(since.getUTCDate()).padStart(2, "0")}/${since.getUTCFullYear()}`,
    printFields: "id,title,awardeeName,estimatedTotalAmt,startDate,fundProgramName,abstractText",
    rpp: "25",
  });
  const data = await json<{ response?: { award?: NsfAward[] } }>(await fetch(`${NSF_API}?${q}`, { cache: "no-store" }), "NSF awards");
  return data.response?.award ?? [];
}

function toNsfAwards(list: NsfAward[], limit: number): PastAward[] {
  return list.slice(0, limit).map((a) => ({
    id: a.id,
    title: a.title,
    recipient: a.awardeeName ?? null,
    amount: a.estimatedTotalAmt ? Number(a.estimatedTotalAmt) : null,
    startDate: mdY(a.startDate),
    program: a.fundProgramName ?? null,
    url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id}`,
    abstract: a.abstractText ? a.abstractText.replace(/<br\/?>/gi, " ").replace(/\s+/g, " ").trim().slice(0, 700) : null,
  }));
}

/** The program segment ("CyberTraining - Training-based" -> "Training-based") that ties an award to this opportunity. */
function matchingSegment(program: string | undefined, title: string, acr: string | null): string | null {
  if (!program) return null;
  const t = title.toLowerCase();
  for (const name of program.split(",").map((x) => x.trim())) {
    if (acr && name.toUpperCase().includes(acr.toUpperCase())) return name;
    if (name.split(" - ").some((seg) => seg.trim().length >= 5 && t.includes(seg.trim().toLowerCase()))) return name;
  }
  return null;
}

export async function nsfPastAwards(o: Pick<Opportunity, "title">, limit = 8): Promise<PastAwards> {
  const acr = programAcronym(o.title);
  const clean = o.title.replace(/\([^)]*\)/g, " ").replace(/[:"/]/g, " ").replace(/\s+/g, " ").trim();
  const since = sinceDate().getUTCFullYear();
  // 1. Filter by NSF program name; keep awards whose program ties back to this title.
  for (const name of [acr, clean.split(" ").slice(0, 6).join(" ")].filter((x): x is string => Boolean(x && x.length >= 3))) {
    const first = (await nsfQuery({ fundProgramName: name })).filter((a) => matchingSegment(a.fundProgramName, o.title, acr));
    if (!first.length) continue;
    const program = matchingSegment(first[0].fundProgramName, o.title, acr)!;
    // Refetch by the exact program name to get a fuller list.
    const more = (await nsfQuery({ fundProgramName: program.split(" - ")[0] })).filter((a) => matchingSegment(a.fundProgramName, o.title, acr));
    const byId = new Map([...first, ...more].map((a) => [a.id, a]));
    const list = [...byId.values()].sort((a, b) => String(mdY(b.startDate)).localeCompare(String(mdY(a.startDate))));
    return {
      source: "NSF Award Search",
      method: `NSF awards in the ${program} program since ${since}`,
      searchUrl: `https://www.nsf.gov/awardsearch/simpleSearchResult?queryText=${encodeURIComponent(program.split(" - ")[0])}`,
      awards: toNsfAwards(list, limit),
      fetchedAt: new Date().toISOString(),
    };
  }
  // 2. Fall back to a keyword search, flagged so the team checks each result.
  const keyword = acr ?? clean.split(" ").slice(0, 6).join(" ");
  const all = await nsfQuery({ keyword: `"${keyword}"` });
  return {
    source: "NSF Award Search",
    method: `NSF awards mentioning "${keyword}" since ${since}. Check that each is from this program.`,
    searchUrl: `https://www.nsf.gov/awardsearch/simpleSearchResult?queryText=${encodeURIComponent(keyword)}`,
    awards: toNsfAwards(all, limit),
    fetchedAt: new Date().toISOString(),
  };
}

interface UsaResult {
  "Award ID": string;
  "Recipient Name": string | null;
  "Award Amount": number | null;
  "Start Date": string | null;
  Description: string | null;
  "Awarding Sub Agency": string | null;
  generated_internal_id: string;
}

export async function usaspendingPastAwards(listings: string[], limit = 8): Promise<PastAwards> {
  const since = sinceDate().toISOString().slice(0, 10);
  const body = {
    filters: {
      award_type_codes: ["02", "03", "04", "05"], // grants and cooperative agreements
      program_numbers: listings,
      time_period: [{ start_date: since, end_date: new Date().toISOString().slice(0, 10) }],
    },
    fields: ["Award ID", "Recipient Name", "Award Amount", "Start Date", "Description", "Awarding Sub Agency", "generated_internal_id"],
    limit,
    sort: "Start Date",
    order: "desc",
  };
  const data = await json<{ results: UsaResult[] }>(
    await fetch(USASPENDING, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }),
    "USAspending",
  );
  return {
    source: "USAspending.gov",
    method: `Awards under Assistance Listing ${listings.join(", ")} since ${since.slice(0, 4)}. A listing can cover several programs, so check that each award is from this one.`,
    searchUrl: `https://www.usaspending.gov/search/?hash=&program_numbers=${encodeURIComponent(listings.join(","))}`,
    awards: data.results.map((r) => ({
      id: r["Award ID"],
      title: r.Description ? r.Description.replace(/^TAS::[^ ]+ [^ ]+::TAS\s*/i, "").slice(0, 200) : r["Award ID"],
      recipient: r["Recipient Name"],
      amount: r["Award Amount"],
      startDate: r["Start Date"],
      program: r["Awarding Sub Agency"],
      url: `https://www.usaspending.gov/award/${encodeURIComponent(r.generated_internal_id)}`,
      abstract: null,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

/** NSF programs use the NSF API (abstracts, program-level match); others use USAspending by listing. */
export async function fetchPastAwards(o: Pick<Opportunity, "title" | "agencyCode" | "assistanceListings">): Promise<PastAwards | null> {
  if ((o.agencyCode ?? "").toUpperCase().startsWith("NSF")) {
    const r = await nsfPastAwards(o);
    if (r.awards.length) return r;
  }
  if (o.assistanceListings?.length) return usaspendingPastAwards(o.assistanceListings);
  return null;
}
