// Rebuilds a document's typed text from its stored text pieces (which overlap a little),
// grouped by page. Pure functions so they can be unit-tested.
import type { Chunk } from "./chunk";

/** Joins b onto a, dropping the part of b that repeats the end of a. */
export function joinOverlap(a: string, b: string): string {
  const max = Math.min(a.length, b.length, 400);
  for (let n = max; n >= 20; n--) {
    if (a.endsWith(b.slice(0, n))) return a + b.slice(n);
  }
  // The overlap may differ slightly in spacing: try matching after trimming.
  const at = a.lastIndexOf(b.slice(0, 40));
  if (at >= 0 && at > a.length - 400) return a.slice(0, at) + b;
  return `${a}\n${b}`;
}

export type TypedSection = { page: number | null; text: string };

export function rebuildText(chunks: Pick<Chunk, "chunk_index" | "page_number" | "content">[]): TypedSection[] {
  const sorted = [...chunks].sort((x, y) => x.chunk_index - y.chunk_index);
  const sections: TypedSection[] = [];
  for (const c of sorted) {
    const last = sections[sections.length - 1];
    if (last && last.page === c.page_number) last.text = joinOverlap(last.text, c.content);
    else if (last) {
      // A new page's piece may still overlap the previous page's end only when pages were merged; keep it simple.
      sections.push({ page: c.page_number, text: c.content });
    } else sections.push({ page: c.page_number, text: c.content });
  }
  return sections;
}
