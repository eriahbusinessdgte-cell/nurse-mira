// Cleaning a large open textbook before it goes into the library (pure — unit tested).
import type { Page } from "./chunk";

/** Lines that repeat on many pages (running headers, footers like "Access for free at openstax.org"). */
export function stripRepeatedLines(pages: Page[]): Page[] {
  if (pages.length < 10) return pages;
  const seen = new Map<string, number>();
  const norm = (l: string) => l.trim().replace(/\d+/g, "#").toLowerCase();
  for (const p of pages) {
    for (const line of new Set(p.text.split("\n").map(norm))) {
      if (line && line.length <= 120) seen.set(line, (seen.get(line) ?? 0) + 1);
    }
  }
  const limit = Math.max(5, pages.length * 0.2);
  const repeated = new Set([...seen.entries()].filter(([, n]) => n >= limit).map(([l]) => l));
  return pages.map((p) => ({
    ...p,
    text: p.text
      .split("\n")
      .filter((l) => !repeated.has(norm(l)))
      .join("\n"),
  }));
}

/**
 * Back-of-book index and table-of-contents pages are mostly "term, 123, 456" lines. They would
 * match almost any keyword search without explaining anything, so they are left out.
 */
export function looksLikeIndexPage(text: string): boolean {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 8) return false;
  // Index: "acute pain, 301, 305". Contents: "1.2 Roles of the Nurse 14" or "Unit 2 Assessment 101".
  const indexLine = /,\s*\d{1,4}(\s*(,|–|-)\s*\d{1,4})*\s*$/;
  const tocLine = /^(\d+(\.\d+)*|unit|chapter|appendix|preface|index|contents)\b.*\s\d{1,4}\s*$/i;
  const pageRefs = lines.filter((l) => l.length < 90 && (indexLine.test(l) || tocLine.test(l))).length;
  return pageRefs / lines.length >= 0.45;
}

export function prepareTextbookPages(pages: Page[]): { pages: Page[]; skipped: number } {
  const cleaned = stripRepeatedLines(pages);
  const kept = cleaned.filter((p) => p.text.trim().length >= 80 && !looksLikeIndexPage(p.text));
  return { pages: kept, skipped: pages.length - kept.length };
}

/**
 * Reference-list pieces ("DailyMed. (Updated …). https://…setid=08decdf3-…") teach nothing and are
 * slow to index (long codes become many tokens — they hit the free plan's 2-second limit).
 */
export function isReferenceChunk(text: string): boolean {
  const urls = text.match(/https?:\/\/\S+/g) ?? [];
  const urlChars = urls.reduce((n, u) => n + u.length, 0);
  return urls.length >= 4 || urlChars / Math.max(1, text.length) >= 0.15;
}
