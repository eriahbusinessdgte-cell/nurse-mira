/** Calendar day in the Philippines (UTC+8), e.g. "2026-11-05". `daysAgo` steps back whole days. */
export function manilaDay(daysAgo = 0): string {
  return new Date(Date.now() + 8 * 3600_000 - daysAgo * 86400_000).toISOString().slice(0, 10);
}
