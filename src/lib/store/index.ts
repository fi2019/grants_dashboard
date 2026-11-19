/**
 * Storage. The baseline keeps everything in one JSON file so the app runs with
 * no database. Swap this module for Postgres/Supabase before deploying to a
 * serverless host (Vercel's filesystem is read-only). Keep the function
 * signatures and the rest of the app will not need to change.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { profile } from "../profile";
import { isImplausibleDeadline, subtractDays } from "../dates";
import type { Opportunity, Stage } from "../types";

const DATA_DIR = process.env.GRANTS_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "opportunities.json");
const SEED_FILE = path.join(DATA_DIR, "seed.json");

interface DbFile {
  version: 1;
  lastScan: ScanLog | null;
  opportunities: Opportunity[];
}

export interface ScanLog {
  startedAt: string;
  finishedAt: string;
  fetched: number;
  added: number;
  evaluated: number;
  bySource: Record<string, number>;
  errors: string[];
}

let writeQueue: Promise<void> = Promise.resolve();

async function readDb(): Promise<DbFile> {
  for (const file of [DB_FILE, SEED_FILE]) {
    try {
      return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file, "utf8")) as DbFile;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return { version: 1, lastScan: null, opportunities: [] };
}

/** Serialize writes so concurrent requests cannot clobber each other. */
async function mutate(fn: (db: DbFile) => void | Promise<void>): Promise<void> {
  const run = writeQueue.then(async () => {
    const db = await readDb();
    await fn(db);
    await fs.mkdir(/*turbopackIgnore: true*/ DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(db, null, 2));
    await fs.rename(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ DB_FILE);
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

export async function listOpportunities(): Promise<Opportunity[]> {
  return (await readDb()).opportunities;
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  return (await readDb()).opportunities.find((o) => o.id === id) ?? null;
}

export async function getLastScan(): Promise<ScanLog | null> {
  return (await readDb()).lastScan;
}

export function defaultReviewDate(closeDate: string | null): string | null {
  if (!closeDate || isImplausibleDeadline(closeDate)) return null;
  return subtractDays(closeDate, profile.internalReviewLeadDays);
}

/**
 * Insert new opportunities and refresh source data on existing ones without
 * touching Forge's decision fields (stage, owner, notes, review date).
 */
export async function upsertOpportunities(items: Opportunity[]): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  await mutate((db) => {
    const byId = new Map(db.opportunities.map((o) => [o.id, o]));
    for (const item of items) {
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, { ...item, internalReviewDate: item.internalReviewDate ?? defaultReviewDate(item.closeDate) });
        added++;
      } else {
        byId.set(item.id, {
          ...existing,
          ...item,
          stage: existing.stage,
          owner: existing.owner,
          notes: existing.notes,
          internalReviewDate: existing.internalReviewDate ?? defaultReviewDate(item.closeDate),
          evaluation: item.evaluation ?? existing.evaluation,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      }
    }
    db.opportunities = [...byId.values()];
  });
  return { added, updated };
}

export interface DecisionPatch {
  stage?: Stage;
  owner?: string | null;
  notes?: string;
  internalReviewDate?: string | null;
}

export async function updateDecision(id: string, patch: DecisionPatch): Promise<Opportunity | null> {
  let result: Opportunity | null = null;
  await mutate((db) => {
    const o = db.opportunities.find((x) => x.id === id);
    if (!o) return;
    Object.assign(o, patch, { updatedAt: new Date().toISOString() });
    result = o;
  });
  return result;
}

export async function saveScanLog(log: ScanLog): Promise<void> {
  await mutate((db) => {
    db.lastScan = log;
  });
}
