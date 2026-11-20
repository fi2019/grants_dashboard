import { evaluateWithClaude, isClaudeConfigured } from "./evaluation/claude";
import { profile } from "./profile";
import { screen } from "./screening/criteria";
import { classifyMechanisms } from "./screening/mechanism";
import { fetchPastAwards } from "./sources/past-awards";
import { CONNECTORS, connectorFor } from "./sources";
import { listOpportunities, saveScanLog, upsertOpportunities, type ScanLog } from "./store";
import type { Opportunity } from "./types";

export interface ScanOptions {
  /** Cap on Claude calls per scan, to control cost. */
  maxEvaluations?: number;
  /** Only send opportunities at or above this pre-score to Claude. */
  minPreScore?: number;
  log?: (msg: string) => void;
}

/**
 * Pipeline: fetch from every connector → skip ones we already have →
 * fetch details → deterministic screen → Claude evaluation for the most
 * promising → save.
 */
export async function runScan(opts: ScanOptions = {}): Promise<ScanLog> {
  const log = opts.log ?? (() => {});
  const maxEvaluations = opts.maxEvaluations ?? Number(process.env.MAX_EVALUATIONS_PER_SCAN ?? 15);
  const minPreScore = opts.minPreScore ?? Number(process.env.MIN_PRESCORE_FOR_EVALUATION ?? 40);
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const bySource: Record<string, number> = {};

  const fetchOpts = {
    keywords: profile.searchKeywords,
    agencyPrefixes: profile.federalAgencies.flatMap((a) => a.grantsGovPrefixes),
    maxPerAgencySweep: 250,
  };

  const fetched: Opportunity[] = [];
  for (const c of CONNECTORS) {
    log(`Fetching ${c.label}…`);
    const r = await c.fetch(fetchOpts);
    bySource[c.id] = r.opportunities.length;
    errors.push(...r.errors);
    fetched.push(...r.opportunities);
  }

  const known = new Set((await listOpportunities()).map((o) => o.id));
  const fresh = fetched.filter((o) => !known.has(o.id));
  log(`${fetched.length} fetched, ${fresh.length} new`);

  for (const o of fresh) {
    const connector = connectorFor(o.source);
    if (connector?.details) {
      try {
        Object.assign(o, await connector.details(o.id.split(":")[1]));
      } catch (e) {
        errors.push(`details ${o.id}: ${(e as Error).message}`);
      }
    }
    o.screening = screen(o);
    o.mechanisms = classifyMechanisms(o);
  }

  // Past awards under the same program, cached per program so shared listings are fetched once.
  const awardCache = new Map<string, Promise<Opportunity["pastAwards"]>>();
  for (const o of fresh) {
    const key = (o.agencyCode ?? "").startsWith("NSF") ? `nsf:${o.title}` : `al:${(o.assistanceListings ?? []).join(",")}`;
    if (!awardCache.has(key)) awardCache.set(key, fetchPastAwards(o).catch((e) => { errors.push(`past awards ${o.id}: ${(e as Error).message}`); return null; }));
    o.pastAwards = await awardCache.get(key)!;
  }

  let evaluated = 0;
  if (isClaudeConfigured()) {
    const candidates = fresh
      .filter((o) => o.screening && o.screening.blockers.length === 0 && o.screening.preScore >= minPreScore)
      .sort((a, b) => b.screening!.preScore - a.screening!.preScore)
      .slice(0, maxEvaluations);
    for (const o of candidates) {
      log(`Evaluating: ${o.title}`);
      try {
        o.evaluation = await evaluateWithClaude(o);
        evaluated++;
      } catch (e) {
        errors.push(`evaluate ${o.id}: ${(e as Error).message}`);
      }
    }
  } else {
    errors.push("ANTHROPIC_API_KEY not set: skipped Claude evaluation; pre-scores only.");
  }

  // Blockers are shown on the opportunity but never auto-decline it: a rule
  // often applies to only one track of a multi-track program.
  for (const o of fresh) {
    if (o.evaluation && o.evaluation.score >= 6) o.stage = "screening";
  }

  const { added } = await upsertOpportunities(fresh);
  const result: ScanLog = {
    startedAt,
    finishedAt: new Date().toISOString(),
    fetched: fetched.length,
    added,
    evaluated,
    bySource,
    errors,
  };
  await saveScanLog(result);
  return result;
}

/** Re-run Claude on one opportunity (from the detail page). */
export async function reevaluate(o: Opportunity): Promise<Opportunity> {
  o.screening = screen(o);
  o.evaluation = await evaluateWithClaude(o);
  await upsertOpportunities([o]);
  return o;
}
