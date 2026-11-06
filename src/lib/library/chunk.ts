// Splits extracted pages into overlapping text pieces for the search index.
// Pure functions — no browser or server APIs — so they can be unit-tested.

export type Page = { page: number | null; text: string };
export type Chunk = { chunk_index: number; page_number: number | null; content: string };

const TARGET = 1100; // characters per piece (about 250 words)
const OVERLAP = 150;

/** Tidies extracted text: joins hyphenated line breaks, collapses spaces, keeps paragraphs. */
export function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLong(text: string): string[] {
  if (text.length <= TARGET) return [text];
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + TARGET, text.length);
    if (end < text.length) {
      // Prefer to break at a paragraph, then a sentence, then a space.
      const window = text.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (breakAt > TARGET * 0.5) end = start + breakAt + 1;
      else {
        const space = window.lastIndexOf(" ");
        if (space > TARGET * 0.5) end = start + space;
      }
    }
    pieces.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }
  return pieces.filter(Boolean);
}

/** One or more pieces per page; very short pages are merged with the next one. */
export function chunkPages(pages: Page[]): Chunk[] {
  const chunks: Chunk[] = [];
  let carry: { page: number | null; text: string } | null = null;

  const push = (page: number | null, text: string) => {
    for (const piece of splitLong(text)) {
      if (piece.length >= 20) chunks.push({ chunk_index: chunks.length, page_number: page, content: piece });
    }
  };

  for (const p of pages) {
    const text = cleanText(p.text);
    if (!text) continue;
    if (carry) {
      const merged: string = `${carry.text}\n\n${text}`;
      carry = null;
      if (merged.length < 300) carry = { page: p.page, text: merged };
      else push(p.page, merged);
      continue;
    }
    if (text.length < 300) carry = { page: p.page, text };
    else push(p.page, text);
  }
  if (carry) push(carry.page, carry.text);
  return chunks;
}

export function totalChars(pages: Page[]) {
  return pages.reduce((n, p) => n + cleanText(p.text).length, 0);
}
