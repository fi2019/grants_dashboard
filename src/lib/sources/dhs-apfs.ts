/**
 * DHS Advance Acquisition Planning Forecast (APFS, moving to 4SITE).
 * DHS publishes the full forecast as a CSV refreshed daily, linked from
 * https://www.dhs.gov/advance-acquisition-planning-forecast-contract-opportunities
 * Only forecasts in Forge-relevant industry codes that also mention Forge's
 * work are kept (about 75 of ~660 on Nov 20, 2026).
 */
import type { Opportunity } from "../types";
import type { FetchOptions, SourceResult } from "./types";

export const DHS_FORECAST_PAGE = "https://www.dhs.gov/advance-acquisition-planning-forecast-contract-opportunities";
const CSV_URL = "https://www.dhs.gov/xlibrary/daily-contract-opportunities-report/APFS_forecast_allRecords.csv";

/** NAICS: computer systems (5415), management/scientific consulting (54161, 54169), R&D (5417), training (6114/6115/6117). */
const RELEVANT_NAICS = /^(5415|54161|54169|5417|6114|6115|6117|541990)/;
const RELEVANT_TEXT = /cyber|threat|intelligence|information sharing|training|workforce|critical infrastructure|resilien|industrial control|operational technology|SCADA|program management|technical assistance|research and development|artificial intelligence|machine learning|data analytic|exercise|grid|energy/i;

/** RFC 4180 CSV parser (quoted fields may contain commas, quotes and newlines). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); if (row.some((x) => x !== "")) rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** "$10M - $19M" -> 19_000_000; "$500K - $999K" -> 999_000. */
export function dollarCeiling(range: string): number | null {
  const nums = [...range.matchAll(/\$\s*([\d.]+)\s*([KMB])?/gi)].map((m) => Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase() as "K" | "M" | "B"] ?? 1));
  return nums.length ? Math.max(...nums) : null;
}

const isoDate = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(`${s.slice(0, 10)}T12:00:00Z`).toISOString() : null);

export function toOpportunity(r: Record<string, string>, now: string): Opportunity {
  const lines = [
    r.Description,
    "",
    `Estimated solicitation release: ${r["Estimated Solicitation Release"] || "not stated"}. Award: ${r["Award Quarter"] || r["Award Date"] || "not stated"}.`,
    `Contract type: ${r["Contract Type"] || "not stated"}${r["Contract Vehicle"] ? `; vehicle: ${r["Contract Vehicle"]}` : ""}. Dollar range: ${r["Dollar Range"] || "not stated"}.`,
    `Status: ${r["Contract Status"] || "not stated"}${r.Contractor ? `; incumbent ${r.Contractor}${r["Contract Number"] ? ` (${r["Contract Number"]})` : ""}` : ""}.`,
    `NAICS: ${r.NAICS}. Requirements office: ${r["Requirements Office"] || r.Component}.`,
    r["Place of Performance City"] || r["Place of Performance State"] ? `Place of performance: ${[r["Place of Performance City"], r["Place of Performance State"]].filter(Boolean).join(", ")}.` : "",
    r["Period of Performance Start"] ? `Period of performance: ${r["Period of Performance Start"]} to ${r["Period of Performance End"] || "?"}.` : "",
    r["Primary Contact Email"] ? `DHS contact: ${[r["Primary Contact First Name"], r["Primary Contact Last Name"]].filter(Boolean).join(" ")}, ${r["Primary Contact Email"]}. Small business coordinator: ${r["Small Business Coordinator Email"] || "not listed"}.` : "",
  ].filter((x) => x !== "");
  return {
    id: `dhs-apfs:${r["APFS Number"]}`,
    source: "dhs-apfs",
    sourceUrl: DHS_FORECAST_PAGE,
    number: r["APFS Number"],
    title: r.Title,
    agency: `DHS ${r.Component}`,
    agencyCode: "DHS",
    description: lines.join("\n"),
    eligibilityText: `Small business set-aside: ${r["Small Business Set-Aside"] || "not stated"}. Small business program: ${r["Small Business Program"] || "not stated"}.`,
    fundingInstruments: ["PC"],
    costSharing: null,
    awardFloor: null,
    awardCeiling: dollarCeiling(r["Dollar Range"] ?? ""),
    estimatedFunding: null,
    expectedAwards: null,
    postedDate: isoDate(r["Forecast Published"] ?? ""),
    closeDate: null,
    status: "forecasted",
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

export async function fetchDhsForecast(_opts?: FetchOptions): Promise<SourceResult> {
  const now = new Date().toISOString();
  try {
    // The site screens request types; a browser-style request is allowed.
    const res = await fetch(CSV_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ForgeGrantsScanner/1.0)", Accept: "text/csv,*/*" }, cache: "no-store" });
    if (!res.ok) return { source: "dhs-apfs", opportunities: [], errors: [`DHS forecast: HTTP ${res.status}`] };
    const rows = parseCsv(await res.text());
    const relevant = rows.filter((r) => r["APFS Number"] && RELEVANT_NAICS.test(r.NAICS ?? "") && RELEVANT_TEXT.test(`${r.Title} ${r.Description}`));
    return { source: "dhs-apfs", opportunities: relevant.map((r) => toOpportunity(r, now)), errors: [] };
  } catch (e) {
    return { source: "dhs-apfs", opportunities: [], errors: [`DHS forecast: ${(e as Error).message}`] };
  }
}
