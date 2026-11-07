// D-060: every student gets their own writing style for AI drafts (case studies, care plans), and
// each request adds a fresh variation — so two classmates drafting the SAME patient don't get the
// same text. Clinical content stays accurate: only wording, structure and explanation change.

const VOICES = [
  "concise and direct — short, precise sentences",
  "explanatory — connect each point to the underlying pathophysiology",
  "structured — open each part with a one-line summary, then the details",
  "formal academic — clear signposting between ideas",
  "clear and plain — simple wording with a brief clinical example where helpful",
  "analytical — emphasise the reasoning that links the data to the conclusion",
];
const SENTENCES = [
  "Lead with the finding, then explain why it matters.",
  "Lead with the reason or principle, then apply it to this patient.",
  "Mix short and longer sentences; prefer active voice.",
  "Prefer complete sentences over fragments, with one idea per sentence.",
];
const ORDERS = [
  "After the priorities, order remaining items from most to least urgent.",
  "Group remaining items by type (assessment, therapeutic, teaching).",
  "After the priorities, order remaining items in the sequence a nurse would do them during the shift.",
];
const RATIONALES = [
  "Write rationales as cause-and-effect explanations.",
  "Write rationales by naming the expected effect on the patient first.",
  "Write rationales that briefly reference the physiological principle involved.",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function writingStyle(studentId: string): string {
  const h = hash(studentId);
  const pick = <T>(list: T[], salt: number) => list[(h >>> salt) % list.length];
  const fresh = Math.floor(Math.random() * 1e6).toString(36);
  return `
WRITING STYLE FOR THIS STUDENT (keep every clinical fact, NANDA-I label and rule above exactly as required — only the writing changes)
- Voice: ${pick(VOICES, 0)}.
- ${pick(SENTENCES, 5)}
- ${pick(ORDERS, 11)}
- ${pick(RATIONALES, 17)}
- Write every sentence freshly in your own words. Avoid stock template phrases (e.g. "This case study aims to…", "The nurse should…" repeated) and don't copy the student's input wording beyond the facts themselves.
- Variation code ${fresh}: use it to choose your own phrasing, examples and sentence openings for this draft.`;
}
