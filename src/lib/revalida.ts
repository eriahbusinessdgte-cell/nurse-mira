// Oral Revalida Practice (D-070): shared types, labels and the session summary.
export const TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  situational: "Situational question",
  tf: "True or false",
  identification: "Identification",
  open: "Open-ended oral question",
  judgment: "Clinical judgment",
  ncp_defense: "Care plan defense",
  med_defense: "Medication defense",
  recall: "Flashcard recall",
};
export const TYPE_KEYS = Object.keys(TYPE_LABEL);

export const DIFFICULTY_LABEL: Record<string, string> = {
  moderate: "Moderate",
  challenging: "Challenging",
  instructor: "Instructor-level",
};

export const BATCH = 5; // questions per AI answer (matches the server function)
export const MAX_QUESTIONS = 40;
export const answersNeeded = (count: number) => Math.ceil(count / BATCH);

export type SelfAssess = "knew" | "partial" | "didnt";
export const SELF_LABEL: Record<SelfAssess, string> = { knew: "I knew it", partial: "I partially knew it", didnt: "I didn't know it" };

export type RevalidaQuestion = {
  id: string;
  session_id: string;
  position: number;
  qtype: string;
  category: string;
  concept: string;
  skill: string;
  hypothetical: boolean;
  question: string;
  options: string[];
  answer_index: number | null;
  answer: string;
  key_points: string[];
  rationale: string;
  case_link: string;
  revealed: boolean;
  skipped: boolean;
  bookmarked: boolean;
  self_assess: SelfAssess | null;
  viewed: boolean;
};
export const QUESTION_COLUMNS =
  "id, session_id, position, qtype, category, concept, skill, hypothetical, question, options, answer_index, answer, key_points, rationale, case_link, revealed, skipped, bookmarked, self_assess, viewed";

export type Analysis = { diagnosis?: string; key_findings?: string[]; medications?: string[]; nursing_diagnoses?: string[]; missing?: string[] };

export type RevalidaSession = {
  id: string;
  case_id: string;
  case_title: string;
  case_revision: number;
  requested: number;
  types: string[];
  difficulty: string;
  status: "generating" | "ready" | "completed";
  generation_note: string | null;
  position: number;
  analysis: Analysis;
  created_at: string;
  completed_at: string | null;
};
export const SESSION_COLUMNS = "id, case_id, case_title, case_revision, requested, types, difficulty, status, generation_note, position, analysis, created_at, completed_at";

/** Counts for the end-of-session summary. No score: the student never submits answers. */
export function summarize(qs: Pick<RevalidaQuestion, "viewed" | "revealed" | "skipped" | "bookmarked" | "self_assess">[]) {
  const n = (f: (q: (typeof qs)[number]) => boolean) => qs.filter(f).length;
  return {
    generated: qs.length,
    viewed: n((q) => q.viewed || q.revealed),
    revealed: n((q) => q.revealed),
    skipped: n((q) => q.skipped && !q.revealed),
    bookmarked: n((q) => q.bookmarked),
    knew: n((q) => q.self_assess === "knew"),
    partial: n((q) => q.self_assess === "partial"),
    didnt: n((q) => q.self_assess === "didnt"),
  };
}

export type ReviewFilter = "all" | "bookmarked" | "didnt" | "partial" | "skipped";
export const FILTER_LABEL: Record<ReviewFilter, string> = {
  all: "All questions",
  bookmarked: "Bookmarked",
  didnt: "Didn't know",
  partial: "Partially knew",
  skipped: "Skipped",
};
export function matchesFilter(q: Pick<RevalidaQuestion, "bookmarked" | "self_assess" | "skipped" | "revealed">, f: ReviewFilter) {
  if (f === "bookmarked") return q.bookmarked;
  if (f === "didnt") return q.self_assess === "didnt";
  if (f === "partial") return q.self_assess === "partial";
  if (f === "skipped") return q.skipped && !q.revealed;
  return true;
}

export const letter = (i: number) => String.fromCharCode(65 + i);

/** Text for the case pasted or uploaded; trims and flags too-short input before any AI is used. */
export const MIN_CASE_CHARS = 300;
export const caseTooShort = (t: string) => t.replace(/\s/g, "").length < MIN_CASE_CHARS;
