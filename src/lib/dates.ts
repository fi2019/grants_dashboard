const DAY_MS = 86_400_000;

/** Whole days from `now` until `iso` (negative when past). Null when no date. */
export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  // Compare calendar days (UTC) so a deadline at 11:59 PM today reads as 0, not 1.
  const target = new Date(t);
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((targetDay - today) / DAY_MS);
}

/**
 * Deadlines more than five years out are almost always placeholder data
 * (the October 2026 sample report showed NSF GRANTED due "10/02/2076").
 */
export function isImplausibleDeadline(iso: string | null | undefined, now = new Date()): boolean {
  const d = daysUntil(iso, now);
  return d !== null && d > 365 * 5;
}

export function subtractDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) - days * DAY_MS).toISOString();
}

/** Parse grants.gov "MM/DD/YYYY" to ISO (end of day Eastern is close enough for planning). */
export function parseUsDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], 23, 59)).toISOString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRange(floor: number | null, ceiling: number | null): string {
  if (floor && ceiling) return `${formatMoney(floor)} – ${formatMoney(ceiling)}`;
  if (ceiling) return `Up to ${formatMoney(ceiling)}`;
  if (floor) return `From ${formatMoney(floor)}`;
  return "—";
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}
