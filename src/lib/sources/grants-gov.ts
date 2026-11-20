/**
 * Grants.gov connector. Uses the public REST API (no key required):
 *   POST https://api.grants.gov/v1/api/search2
 *   POST https://api.grants.gov/v1/api/fetchOpportunity
 * Docs: https://www.grants.gov/api/applicant/
 */
import { parseUsDate } from "../dates";
import type { Opportunity } from "../types";
import type { FetchOptions, SourceResult } from "./types";

const API = "https://api.grants.gov/v1/api";

interface SearchHit {
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agency: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  cfdaList?: string[];
}

interface AgencyFacet {
  value: string;
  subAgencyOptions?: { value: string }[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`grants.gov ${path}: HTTP ${res.status}`);
  const json = (await res.json()) as { errorcode: number; msg: string; data: T };
  if (json.errorcode !== 0) throw new Error(`grants.gov ${path}: ${json.msg}`);
  return json.data;
}

async function search(params: Record<string, unknown>): Promise<{ hits: SearchHit[]; agencies: AgencyFacet[] }> {
  const data = await post<{ oppHits: SearchHit[]; agencies: AgencyFacet[] }>("search2", {
    oppStatuses: "posted|forecasted",
    rows: 25,
    ...params,
  });
  return { hits: data.oppHits ?? [], agencies: data.agencies ?? [] };
}

/**
 * Grants.gov filters on exact agency codes (e.g. "DOE-GFO"), not prefixes, so
 * expand our profile prefixes ("DOE") using the agency facet list.
 */
export async function expandAgencyCodes(prefixes: string[]): Promise<string[]> {
  const { agencies } = await search({ keyword: "", rows: 0 });
  const all = agencies.flatMap((a) => [a.value, ...(a.subAgencyOptions ?? []).map((s) => s.value)]);
  return [...new Set(all.filter((code) => prefixes.some((p) => code === p || code.startsWith(`${p}-`))))];
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", bull: "•",
};

/** Decode HTML entities. Loops because grants.gov sometimes double-encodes ("&amp;nbsp;"). */
export function decodeEntities(text: string): string {
  let prev = "";
  let out = text;
  for (let i = 0; i < 3 && out !== prev; i++) {
    prev = out;
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  return out;
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\u2022 ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() || null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface Synopsis {
  synopsisDesc?: string;
  applicantEligibilityDesc?: string;
  applicantTypes?: { description: string }[];
  costSharing?: string | boolean;
  awardFloor?: string;
  awardCeiling?: string;
  fundingInstruments?: { id: string; description?: string }[];
  estimatedFunding?: string;
  numberOfAwards?: string;
  responseDateStr?: string;
}

export async function fetchDetails(id: string): Promise<Partial<Opportunity>> {
  const data = await post<{ synopsis?: Synopsis; forecast?: Synopsis; cfdas?: { cfdaNumber?: string }[] }>("fetchOpportunity", {
    opportunityId: Number(id),
  });
  const s = data.synopsis ?? data.forecast ?? {};
  const applicantTypes = Array.isArray(s.applicantTypes)
    ? s.applicantTypes.map((t) => t.description).join("; ")
    : "";
  const cost = String(s.costSharing ?? "").toLowerCase();
  const listings = (data.cfdas ?? []).map((c) => c.cfdaNumber).filter((x): x is string => Boolean(x));
  const instruments = Array.isArray(s.fundingInstruments) ? s.fundingInstruments.map((f) => f.id).filter(Boolean) : [];
  return {
    ...(instruments.length ? { fundingInstruments: instruments } : {}),
    ...(listings.length ? { assistanceListings: [...new Set(listings)] } : {}),
    description: stripHtml(s.synopsisDesc),
    eligibilityText: [applicantTypes, stripHtml(s.applicantEligibilityDesc)].filter(Boolean).join("\n\n") || null,
    costSharing: cost === "true" ? true : cost === "false" ? false : null,
    awardFloor: num(s.awardFloor),
    awardCeiling: num(s.awardCeiling),
    estimatedFunding: num(s.estimatedFunding),
    expectedAwards: num(s.numberOfAwards),
  };
}

function toOpportunity(hit: SearchHit, now: string): Opportunity {
  return {
    id: `grants.gov:${hit.id}`,
    source: "grants.gov",
    sourceUrl: `https://www.grants.gov/search-results-detail/${hit.id}`,
    number: hit.number || null,
    title: decodeEntities(hit.title),
    agency: hit.agency ? decodeEntities(hit.agency) : null,
    agencyCode: hit.agencyCode || null,
    description: null,
    eligibilityText: null,
    assistanceListings: hit.cfdaList ?? [],
    costSharing: null,
    awardFloor: null,
    awardCeiling: null,
    estimatedFunding: null,
    expectedAwards: null,
    postedDate: parseUsDate(hit.openDate),
    closeDate: parseUsDate(hit.closeDate),
    status: hit.oppStatus === "posted" || hit.oppStatus === "forecasted" ? hit.oppStatus : "unknown",
    fetchedAt: now,
    screening: null,
    evaluation: null,
    stage: "new",
    internalReviewDate: null,
    owner: null,
    notes: "",
    updatedAt: now,
  };
}

export async function fetchGrantsGov(opts: FetchOptions): Promise<SourceResult> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  const found = new Map<string, Opportunity>();

  // 1. Keyword searches across all agencies.
  for (const keyword of opts.keywords) {
    try {
      const { hits } = await search({ keyword });
      for (const h of hits) if (!found.has(h.id)) found.set(h.id, toOpportunity(h, now));
    } catch (e) {
      errors.push(`grants.gov "${keyword}": ${(e as Error).message}`);
    }
  }

  // 2. Everything open at the priority federal agencies.
  if (opts.agencyPrefixes.length) {
    try {
      const codes = await expandAgencyCodes(opts.agencyPrefixes);
      if (codes.length) {
        const { hits } = await search({ keyword: "", agencies: codes.join("|"), rows: opts.maxPerAgencySweep });
        for (const h of hits) if (!found.has(h.id)) found.set(h.id, toOpportunity(h, now));
      }
    } catch (e) {
      errors.push(`grants.gov agency sweep: ${(e as Error).message}`);
    }
  }

  return { source: "grants.gov", opportunities: [...found.values()], errors };
}
