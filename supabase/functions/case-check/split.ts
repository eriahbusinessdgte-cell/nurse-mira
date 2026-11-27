// Case Study Checker (D-072): split an imported case study into sections, group them into AI-sized parts,
// and tell which outline it follows. Pure functions, unit-tested in tests/case-check.test.ts.

export type CheckSection = { title: string; original: string; revised: string | null; note?: string };
export type Part = { sections: number[]; done: boolean };

export const PART_CHARS = 6000; // one AI answer reads and rewrites about this much
export const MAX_CHARS = 60000; // about 25 pages

const KNOWN = [
  "introduction", "objectives?", "general objectives?", "specific objectives?", "significance of the study", "scope and limitations?",
  "patient'?s? profile", "client'?s? profile", "patient'?s? information", "family profile", "family structure.*", "demographic data",
  "chief complaint", "history of present illness", "past (medical|health) history", "family (medical|health) history", "history of past illness",
  "obstetric(al)? history", "socio-?economic.*", "home and environment.*", "environmental (assessment|factors)", "physical assessment",
  "physical examination", "review of systems", "gordon'?s.*", "functional health patterns?", "developmental (task|data|history).*",
  "anatomy and physiology", "pathophysiology", "laboratory.*", "diagnostic.*", "medical management", "surgical management",
  "drug stud(y|ies)", "nursing care plans?", "family nursing care plans?", "ncp", "fncp", "discharge plan(ning)?", "health teachings?",
  "evaluation", "conclusion", "recommendations?", "references?", "bibliography", "first level assessment", "second level assessment",
  "typology of nursing problems", "scale (of|for) ranking.*", "prioriti[sz]ation.*", "list of health problems.*", "problem prioriti[sz]ation",
].join("|");
const KNOWN_RE = new RegExp(`^(?:[IVX]+\\.|[A-H]\\.|\\d{1,2}\\.)?\\s*(?:${KNOWN})\\s*:?$`, "i");
const CHAPTER_RE = /^(chapter|part|unit)\s+([ivx]+|\d{1,2})\b.{0,80}$/i;
const LETTERED_RE = /^(?:[IVX]{1,4}|[A-H])\.\s+[A-Z][^.!?]{2,120}$/; // "B. Socio-economic and Cultural Factors", "IV. Pathophysiology"

export function isHeading(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 130) return false;
  if (/^#{1,4}\s+\S/.test(l)) return true;
  if (/^[●•\-*–]/.test(l)) return false; // bullets
  return CHAPTER_RE.test(l) || KNOWN_RE.test(l.replace(/[*_]/g, "")) || LETTERED_RE.test(l);
}

const cleanTitle = (l: string) =>
  l.trim().replace(/^#{1,4}\s+/, "").replace(/[*_]/g, "").replace(/:$/, "").replace(/^(CHAPTER|PART|UNIT)\b/, (w) => w[0] + w.slice(1).toLowerCase()).replace(/\s+/g, " ").trim().slice(0, 120);

/** Split text into sections at headings. A "Chapter N" line followed by a short title line becomes one title. */
export function splitIntoSections(text: string): CheckSection[] {
  // PDFs often carry invisible zero-width characters and page-break marks.
  const lines = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/\r|\f/g, "\n").split("\n");
  const out: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } = { title: "Beginning", body: [] };
  // The next non-blank line within 3 lines (PDFs often put blank lines between a heading's parts).
  const nextLine = (i: number) => {
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) if (lines[j].trim()) return j;
    return -1;
  };
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // A lone "E." whose title is on the next line → one heading.
    if (/^\s*[A-H]\.\s*$/.test(line)) {
      const j = nextLine(i);
      if (j > 0 && isHeading(`${line.trim()} ${lines[j].trim()}`)) {
        line = `${line.trim()} ${lines[j].trim()}`;
        i = j;
      }
    }
    if (isHeading(line)) {
      let title = cleanTitle(line);
      // "CHAPTER 1" + next short line ("Family Assessment") → "Chapter 1 – Family Assessment"
      if (CHAPTER_RE.test(line.trim()) && title.split(/\s+/).length <= 3) {
        const j = nextLine(i);
        const next = j > 0 ? lines[j].trim() : "";
        if (next && next.length <= 80 && !/[.!?]$/.test(next) && !isHeading(next)) {
          title = `${title} – ${cleanTitle(next)}`;
          i = j;
        }
      }
      if (current.body.join("").trim() || current.title !== "Beginning") out.push(current);
      current = { title, body: [] };
    } else current.body.push(line);
  }
  out.push(current);
  let sections: CheckSection[] = out
    .map((s) => ({ title: s.title, original: s.body.join("\n").replace(/\n{3,}/g, "\n\n").trim(), revised: null }))
    .filter((s, i, all) => s.original || all.length === 1 || (s.title !== "Beginning" && i < all.length));
  // A heading with nothing under it (e.g. "Chapter 2" right before "A. ...") is folded into the next section's title —
  // unless both are chapters (an empty chapter, e.g. a care plan pasted as a picture, stays as its own section).
  // A heading repeated at the top of each page (table headers) joins the section before it.
  sections = sections.reduce<CheckSection[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.title === s.title) {
      prev.original = `${prev.original}\n\n${s.original}`.trim();
      return acc;
    }
    if (prev && !prev.original && !(CHAPTER_RE.test(prev.title) && CHAPTER_RE.test(s.title))) {
      prev.title = `${prev.title} – ${s.title}`.slice(0, 120);
      prev.original = s.original;
      return acc;
    }
    acc.push(s);
    return acc;
  }, []);
  if (sections.length === 1 && sections[0].title === "Beginning") sections[0].title = "Case study";
  // Very long sections are split at paragraph breaks so one AI answer can handle each piece.
  return sections.flatMap((s) => (s.original.length <= PART_CHARS ? [s] : chunk(s.original).map((c, i) => ({ title: i ? `${s.title} (continued)` : s.title, original: c, revised: null }))));
}

function chunk(text: string): string[] {
  const paras = text.split(/\n\s*\n|\n(?=[●•\-*] )/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > PART_CHARS) {
      out.push(cur.trim());
      cur = "";
    }
    if (p.length > PART_CHARS) {
      for (let i = 0; i < p.length; i += PART_CHARS) out.push(p.slice(i, i + PART_CHARS).trim());
    } else cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Group consecutive sections into parts of at most PART_CHARS characters. */
export function makeParts(sections: CheckSection[]): Part[] {
  const parts: Part[] = [];
  let cur: number[] = [];
  let size = 0;
  sections.forEach((s, i) => {
    const len = s.original.length + s.title.length;
    if (cur.length && size + len > PART_CHARS) {
      parts.push({ sections: cur, done: false });
      cur = [];
      size = 0;
    }
    cur.push(i);
    size += len;
  });
  if (cur.length) parts.push({ sections: cur, done: false });
  return parts;
}

/** CHN family case presentation vs. hospital case study. */
export function detectFormat(text: string): "chn" | "hospital" {
  const t = text.toLowerCase();
  const chn = ["typology", "health threat", "health deficit", "foreseeable crisis", "second level assessment", "first level assessment", "scale of ranking", "modifiability", "salience", "family nursing", "home and environment", "fncp"]
    .filter((w) => t.includes(w)).length;
  return chn >= 3 ? "chn" : "hospital";
}

export const OUTLINES: Record<"chn" | "hospital", string> = {
  chn: "CHN family case presentation: Chapter 1 Family assessment (A. family structure/demographics, B. socio-economic and cultural factors, C. home and environment, D. physical assessment — Gordon's 11 functional health patterns and head-to-toe physical examination of the client); Chapter 2 First-level assessment (typology: health threats, health deficits, foreseeable crises, each with rationale); Chapter 3 Second-level assessment (reasons for inability to cope → family nursing diagnosis); Chapter 4 Scale of ranking criteria (nature 1, modifiability 2, preventive potential 1, salience 1; score/highest × weight); Chapter 5 Problems ranked by priority with score and justification per criterion; Chapter 6 Family nursing care plan; Chapter 7 Drug study (name/dose/route/frequency, classification, mechanism, indications, contraindications, side/adverse effects, nursing responsibilities).",
  hospital: "Hospital nursing case study: introduction, objectives, patient profile, chief complaint and history of present illness, past/family history, physical assessment (head-to-toe and/or Gordon's), anatomy and physiology, pathophysiology, laboratory and diagnostic results with interpretation, medical/surgical management, drug study, nursing care plans (assessment cues, nursing diagnosis, goals, interventions with rationale, evaluation), discharge plan (e.g. METHOD), conclusion, references.",
};

// ---- Fact guard: a light revision must not quietly change facts ----
const NUM_WORDS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
// Words that carry a fact the student must decide (marital status, setting, side/level of the body).
const FACT_WORDS = ["widowed", "widow", "widower", "married", "separated", "annulled", "deceased", "rural", "urban", "urbanized", "bilateral"];
// Side or level of a body part ("left eye", "lower-limb", "right knee").
const SIDE_RE = /\b(left|right|lower|upper)[\s-]+(limbs?|legs?|arms?|extremit\w*|eyes?|ears?|side|foot|feet|hands?|knees?|hips?|breasts?|lungs?|quadrant)\b/gi;

function numbers(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+(?:\.\d+)?/g)) out.add(String(Number(m[0])));
  for (const w of s.toLowerCase().match(/\b[a-z]+\b/g) ?? []) if (NUM_WORDS[w]) out.add(NUM_WORDS[w]);
  return out;
}
function countWord(s: string, w: string) {
  return (s.toLowerCase().match(new RegExp(`\\b${w}\\b`, "g")) ?? []).length;
}

/** Returns a short reason when the revision dropped a number or added/removed a fact word; null when it's safe. */
export function factGuard(original: string, revised: string): string | null {
  const after = numbers(revised);
  const lost = [...numbers(original)].filter((n) => !after.has(n));
  if (lost.length) return `a number from your text (${lost.slice(0, 3).join(", ")}) was missing from the suggestion`;
  for (const w of FACT_WORDS) {
    const a = countWord(original, w), b = countWord(revised, w);
    if (b > a) return `the suggestion added "${w}", which isn't in your text`;
    if (b < a) return `the suggestion removed "${w}" from your text`;
  }
  const sides = (t: string) => (t.match(SIDE_RE) ?? []).map((m) => m.toLowerCase().replace(/[\s-]+/, " ").replace(/s$/, "")).sort().join("|");
  if (sides(original) !== sides(revised)) return "the suggestion changed or added which side or part of the body is involved";
  return null;
}

/** The AI sometimes repeats the section title as the first line of its revision — drop it. */
export function stripEchoedTitle(title: string, revised: string): string {
  const first = revised.split("\n")[0].trim().replace(/[:.]$/, "").toLowerCase();
  const t = title.toLowerCase();
  if (first && (first === t || t.endsWith(first)) && first.length >= 6) return revised.split("\n").slice(1).join("\n").trim();
  return revised;
}
