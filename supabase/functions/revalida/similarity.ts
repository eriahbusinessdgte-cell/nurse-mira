// Repeat detection helpers for Oral Revalida (pure functions; unit-tested in tests/revalida.test.ts).
const STOP = new Set(("a an the and or of to in on for with without at by from as is are was were be been being this that these those it its " +
  "your you yours patient patients client case why what how when which who whom whose would could should will can do does did " +
  "explain describe discuss give state identify list name tell me about importance important please also then than into").split(" "));
export const normalize = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => w.replace(/(ing|ed|es|s|ly|tion|ment)$/, "");
export const words = (t: string) => new Set(normalize(t).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
export function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const j = shared / (a.size + b.size - shared);
  // Blend of containment and Jaccard; containment only counts when both questions have some substance,
  // so a short recall item ("Define ectopic pregnancy") doesn't block every later question about the same disease.
  return Math.min(a.size, b.size) >= 4 ? (shared / Math.min(a.size, b.size)) * 0.5 + j * 0.5 : j;
}
export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}
