// Nursing care plan shape and helpers (pure, unit-tested).

export type Intervention = { action: string; rationale: string; kind: "independent" | "dependent" | "collaborative" };
export type Plan = {
  diagnosis: string;
  assessment: { subjective: string[]; objective: string[] };
  to_assess: string[];
  outcomes: { short_term: string[]; long_term: string[] };
  planning: string;
  interventions: Intervention[];
  evaluation: string;
};

export const emptyPlan = (): Plan => ({
  diagnosis: "",
  assessment: { subjective: [], objective: [] },
  to_assess: [],
  outcomes: { short_term: [], long_term: [] },
  planning: "",
  interventions: [{ action: "", rationale: "", kind: "independent" }],
  evaluation: "",
});

/** Normalises a stored plan so the editor never breaks on missing fields. */
export function normalizePlan(p: Partial<Plan> | null | undefined): Plan {
  const e = emptyPlan();
  return {
    diagnosis: p?.diagnosis ?? "",
    assessment: { subjective: p?.assessment?.subjective ?? [], objective: p?.assessment?.objective ?? [] },
    to_assess: p?.to_assess ?? [],
    outcomes: { short_term: p?.outcomes?.short_term ?? [], long_term: p?.outcomes?.long_term ?? [] },
    planning: p?.planning ?? "",
    interventions: p?.interventions?.length ? p.interventions : e.interventions,
    evaluation: p?.evaluation ?? "",
  };
}

/** One line per list item <-> textarea text. */
export const toLines = (list: string[]) => list.join("\n");
export const fromLines = (text: string) => text.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trimEnd()).filter((l, i, a) => l.trim() || i < a.length - 1);

const KIND = { independent: "Independent", dependent: "Dependent", collaborative: "Collaborative" } as const;
const bullets = (list: string[]) => (list.filter((x) => x.trim()).length ? list.filter((x) => x.trim()).map((x) => `- ${x.trim()}`).join("\n") : "- (none)");
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n+/g, " ").trim();

/** Markdown for Word export and printing. */
export function planToMarkdown(p: Plan): string {
  return [
    `### Assessment`,
    `**Subjective cues**`,
    bullets(p.assessment.subjective),
    `**Objective cues**`,
    bullets(p.assessment.objective),
    ...(p.to_assess.some((x) => x.trim()) ? [`**Still to assess**`, bullets(p.to_assess)] : []),
    `### Nursing Diagnosis`,
    p.diagnosis || "(not written yet)",
    `### Outcomes`,
    `**Short-term**`,
    bullets(p.outcomes.short_term),
    `**Long-term**`,
    bullets(p.outcomes.long_term),
    `### Planning`,
    p.planning || "(not written yet)",
    `### Nursing Interventions and Rationale`,
    `| # | Nursing intervention | Type | Rationale |`,
    `| --- | --- | --- | --- |`,
    ...p.interventions.filter((i) => i.action.trim()).map((i, n) => `| ${n + 1} | ${cell(i.action)} | ${KIND[i.kind]} | ${cell(i.rationale)} |`),
    `### Evaluation`,
    p.evaluation || "(not written yet)",
  ].join("\n");
}

/** A short title for lists: the problem part of the diagnosis. */
export function planTitle(p: Plan) {
  const d = p.diagnosis.trim();
  if (!d) return "Untitled care plan";
  const cut = d.search(/\s+(related to|r\/t|as evidenced by|secondary to)\b/i);
  return (cut > 0 ? d.slice(0, cut) : d).slice(0, 90);
}
