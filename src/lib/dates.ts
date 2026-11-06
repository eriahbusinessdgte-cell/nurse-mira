/** Calendar day in the Philippines (UTC+8), e.g. "2026-11-05". `daysAgo` steps back whole days. */
export function manilaDay(daysAgo = 0): string {
  return new Date(Date.now() + 8 * 3600_000 - daysAgo * 86400_000).toISOString().slice(0, 10);
}

/** UTC calendar day `daysAgo` days back (Cloudflare's allowance runs on UTC days). */
export function utcDay(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);
}

/** True if the time is within the last `days` days. */
export function withinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() < days * 86400_000;
}
