// Builds the admin's "AI & Problems" tables from raw counts.

export type ProviderCount = { day: string; provider: string; model: string; answers: number };

export const PROVIDER_LABEL = (provider: string, model: string) => {
  if (provider === "cloudflare") return "Cloudflare (backup)";
  if (provider === "groq" && /(^|[^0-9])20b/.test(model)) return "Groq small model (last backup)";
  if (provider === "groq") return "Groq (main)";
  return "Other";
};

export type DayRow = { day: string; answers: number; students: number; units: number; pages: number; backup: number };

/** One row per day, newest first, filling days with no use with zeros. */
export function dailyRows(
  days: string[],
  usage: { day: string; student_id: string; answers: number }[],
  cloudflare: { day: string; neurons: number; pages: number }[],
  providers: ProviderCount[],
): DayRow[] {
  return days.map((day) => {
    const u = usage.filter((r) => r.day === day);
    const cf = cloudflare.find((r) => r.day === day);
    return {
      day,
      answers: u.reduce((n, r) => n + r.answers, 0),
      students: new Set(u.filter((r) => r.answers > 0).map((r) => r.student_id)).size,
      units: Math.round(Number(cf?.neurons ?? 0)),
      pages: cf?.pages ?? 0,
      backup: providers.filter((p) => p.day === day && PROVIDER_LABEL(p.provider, p.model) !== "Groq (main)").reduce((n, p) => n + p.answers, 0),
    };
  });
}

export function providerTotals(providers: ProviderCount[]) {
  const totals = new Map<string, number>();
  for (const p of providers) {
    const label = PROVIDER_LABEL(p.provider, p.model);
    totals.set(label, (totals.get(label) ?? 0) + Number(p.answers));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([label, answers]) => ({ label, answers }));
}

export const TOOL_LABEL: Record<string, string> = {
  tutor: "AI Tutor",
  review: "Review Center",
  quiz: "Quizzes",
  "case-draft": "Case study draft",
  ncp: "Care plans",
  "drug-study": "Drug studies",
  "read-page": "Handwriting reader",
  embed: "Library search setup",
  page: "A page",
};

export const KIND_LABEL: Record<string, string> = {
  limit: "Reached daily answers",
  budget: "Daily allowance used up",
  unavailable: "AI service busy or down",
  unreachable: "Couldn't connect",
  crash: "Page broke",
  error: "Error",
};

/** Problems that are normal use rather than something broken. */
export const isExpected = (kind: string) => kind === "limit" || kind === "budget";
