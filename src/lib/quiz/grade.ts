// Quiz question types and grading. Pure functions so they can be unit-tested.

export type Question =
  | { id: string; type: "mcq" | "scenario"; question: string; options: string[]; answer: number; rationale: string; topic: string }
  | { id: string; type: "multi"; question: string; options: string[]; answer: number[]; rationale: string; topic: string }
  | { id: string; type: "tf"; question: string; answer: boolean; rationale: string; topic: string }
  | { id: string; type: "identification"; question: string; answer: string; accept?: string[]; rationale: string; topic: string };

/** What a student gave: option index, list of indexes, true/false, or typed text. */
export type Given = number | number[] | boolean | string | null | undefined;

export const TYPE_LABEL: Record<Question["type"], string> = {
  mcq: "Multiple choice",
  scenario: "Situational",
  multi: "Select all that apply",
  tf: "True or false",
  identification: "Identification",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Small typing mistakes are forgiven for longer words (e.g. "zidovudin"). */
function closeEnough(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  // Levenshtein distance ≤ 1
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function isCorrect(q: Question, given: Given): boolean {
  if (given === null || given === undefined || given === "") return false;
  switch (q.type) {
    case "mcq":
    case "scenario":
      return given === q.answer;
    case "tf":
      return given === q.answer;
    case "multi": {
      if (!Array.isArray(given)) return false;
      const a = [...new Set(given)].sort((x, y) => x - y);
      const b = [...q.answer].sort((x, y) => x - y);
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    case "identification": {
      if (typeof given !== "string") return false;
      const g = norm(given);
      return [q.answer, ...(q.accept ?? [])].some((ok) => closeEnough(g, norm(ok)));
    }
  }
}

export type Result = { score: number; total: number; byTopic: Record<string, { right: number; total: number }> };

export function grade(questions: Question[], answers: Record<string, Given>): Result {
  const byTopic: Result["byTopic"] = {};
  let score = 0;
  for (const q of questions) {
    const ok = isCorrect(q, answers[q.id]);
    if (ok) score++;
    const t = (byTopic[q.topic || "General"] ??= { right: 0, total: 0 });
    t.total++;
    if (ok) t.right++;
  }
  return { score, total: questions.length, byTopic };
}

/** Topics answered correctly less than 70% of the time across attempts (at least 2 questions seen). */
export function weakTopics(attempts: { by_topic: Record<string, { right: number; total: number }> }[], max = 6) {
  const sum: Record<string, { right: number; total: number }> = {};
  for (const a of attempts) {
    for (const [topic, v] of Object.entries(a.by_topic ?? {})) {
      const s = (sum[topic] ??= { right: 0, total: 0 });
      s.right += v.right;
      s.total += v.total;
    }
  }
  return Object.entries(sum)
    .filter(([, v]) => v.total >= 2 && v.right / v.total < 0.7)
    .map(([topic, v]) => ({ topic, right: v.right, total: v.total, percent: Math.round((v.right / v.total) * 100) }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, max);
}

/** The correct answer written out for the results page. */
export function answerText(q: Question): string {
  switch (q.type) {
    case "mcq":
    case "scenario":
      return q.options[q.answer] ?? "";
    case "multi":
      return q.answer.map((i) => q.options[i]).join("; ");
    case "tf":
      return q.answer ? "True" : "False";
    case "identification":
      return q.answer;
  }
}
