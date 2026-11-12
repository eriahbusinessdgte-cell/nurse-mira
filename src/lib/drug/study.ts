// Drug study shape and helpers (pure, unit-tested). D-065.

export type DrugStudy = {
  generic_name: string;
  brand_names: string;
  classification: { pharmacologic: string; therapeutic: string };
  order: string; // dose, route, frequency — as the student wrote it from the doctor's order
  mechanism: string;
  indications: string[];
  indication_for_patient: string;
  contraindications: string[];
  side_effects: string[];
  adverse_effects: string[];
  interactions: string[];
  responsibilities: { before: string[]; during: string[]; after: string[] };
  teaching: string[];
};

export const emptyStudy = (): DrugStudy => ({
  generic_name: "",
  brand_names: "",
  classification: { pharmacologic: "", therapeutic: "" },
  order: "",
  mechanism: "",
  indications: [],
  indication_for_patient: "",
  contraindications: [],
  side_effects: [],
  adverse_effects: [],
  interactions: [],
  responsibilities: { before: [], during: [], after: [] },
  teaching: [],
});

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Normalises a stored study so the editor never breaks on missing fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeStudy(s: any): DrugStudy {
  return {
    generic_name: text(s?.generic_name),
    brand_names: text(s?.brand_names),
    classification: { pharmacologic: text(s?.classification?.pharmacologic), therapeutic: text(s?.classification?.therapeutic) },
    order: text(s?.order),
    mechanism: text(s?.mechanism),
    indications: list(s?.indications),
    indication_for_patient: text(s?.indication_for_patient),
    contraindications: list(s?.contraindications),
    side_effects: list(s?.side_effects),
    adverse_effects: list(s?.adverse_effects),
    interactions: list(s?.interactions),
    responsibilities: { before: list(s?.responsibilities?.before), during: list(s?.responsibilities?.during), after: list(s?.responsibilities?.after) },
    teaching: list(s?.teaching),
  };
}

export const studyTitle = (s: DrugStudy) => [s.generic_name.trim() || "Untitled drug", s.brand_names.trim() ? `(${s.brand_names.trim()})` : ""].filter(Boolean).join(" ");

const clean = (s: string) => s.replace(/\|/g, "/").replace(/\s*\n+\s*/g, " ").trim();
const items = (l: string[]) => {
  const kept = l.map(clean).filter(Boolean);
  return kept.length ? kept.map((x) => `• ${x}`).join("<br>") : "—";
};

/** The rows of a drug study, in the usual school order. Used for printing and Word export. */
export function studyRows(s: DrugStudy): [string, string][] {
  return [
    ["Generic name", clean(s.generic_name) || "—"],
    ["Brand name(s)", clean(s.brand_names) || "—"],
    ["Classification", [s.classification.pharmacologic && `Pharmacologic: ${clean(s.classification.pharmacologic)}`, s.classification.therapeutic && `Therapeutic: ${clean(s.classification.therapeutic)}`].filter(Boolean).join("<br>") || "—"],
    ["Dosage, route and frequency (as ordered)", clean(s.order) || "—"],
    ["Mechanism of action", clean(s.mechanism) || "—"],
    ["Indications", items(s.indications) + (s.indication_for_patient.trim() ? `<br>**For this patient:** ${clean(s.indication_for_patient)}` : "")],
    ["Contraindications", items(s.contraindications)],
    ["Side effects", items(s.side_effects)],
    ["Adverse effects", items(s.adverse_effects)],
    ["Drug interactions", items(s.interactions)],
    ["Nursing responsibilities – before", items(s.responsibilities.before)],
    ["Nursing responsibilities – during", items(s.responsibilities.during)],
    ["Nursing responsibilities – after", items(s.responsibilities.after)],
    ["Patient / family teaching", items(s.teaching)],
  ];
}

/** Markdown table (for Word export; "<br>" becomes a line break). */
export function studyToMarkdown(s: DrugStudy): string {
  return ["| Part | Details |", "| --- | --- |", ...studyRows(s).map(([k, v]) => `| **${k}** | ${v} |`)].join("\n");
}
