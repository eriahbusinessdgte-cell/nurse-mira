// Case Study Builder: the case information form, default sections, and the
// de-identification check. Pure functions so they can be unit-tested.

export type Facts = Partial<Record<FactKey, string>>;
export type Section = { id: string; title: string; content: string };

export const FACT_FIELDS = [
  { key: "profile", label: "Patient profile", hint: "Age, sex, civil status, occupation, religion — never the name. Use “Patient A”." },
  { key: "diagnosis", label: "Medical diagnosis / impression", hint: "e.g. Pregnancy-induced hypertension, G2P1, 34 weeks AOG" },
  { key: "complaint", label: "Chief complaint and history of present illness", hint: "What brought the patient in, and how it developed." },
  { key: "history", label: "Past medical, family and obstetric history", hint: "Illnesses, surgeries, allergies, OB score, family history." },
  { key: "assessment", label: "Vital signs and nursing assessment findings", hint: "Only what was actually observed or measured." },
  { key: "diagnostics", label: "Laboratory and diagnostic results", hint: "Test, result, normal range, date (day of stay is enough)." },
  { key: "medical", label: "Medical management", hint: "Doctor's orders, medications, IV fluids, oxygen." },
  { key: "surgical", label: "Surgical management", hint: "Procedures done or planned. Write “none” if none." },
  { key: "supportive", label: "Supportive care", hint: "Diet, activity, positioning, emotional support, etc." },
  { key: "notes", label: "Other notes", hint: "Your instructor's requirements or what to focus on." },
] as const;
export type FactKey = (typeof FACT_FIELDS)[number]["key"];

export const DEFAULT_SECTIONS = [
  "Introduction",
  "Past Medical and Obstetric History",
  "Diagnostic Procedure Findings",
  "Medical Management",
  "Surgical Management",
  "Supportive Care",
  "Nursing Care Plans",
  "Patient Education, Discharge Plan, and Follow-up",
];

export const newSectionId = () => `s${Math.random().toString(36).slice(2, 9)}`;
export const defaultSections = (): Section[] => DEFAULT_SECTIONS.map((title) => ({ id: newSectionId(), title, content: "" }));

/** Things that could identify a real patient. Returns plain-English warnings. */
export function findIdentifiers(text: string): string[] {
  const found = new Set<string>();
  const checks: [RegExp, string][] = [
    [/\b(Mr|Mrs|Ms|Miss|Mx|Gng|Bb|Lola|Lolo|Aling|Mang)\.?\s+[A-Z][a-z]{2,}/, "A name with a title (e.g. “Mrs. Santos”) — use “Patient A” instead."],
    [/\b(patient'?s?\s+name|full\s*name|pangalan)\s*[:\-]/i, "A “name:” field — remove the patient's name."],
    [/\b(hospital|case|record|chart|room|bed|admission)\s*(no\.?|number|#)\s*[:#]?\s*[A-Z0-9-]{3,}/i, "A hospital, case, room or record number."],
    [/\b(MRN|PhilHealth|PIN|SSS|GSIS|TIN)\b\s*[:#]?\s*[0-9][0-9 -]{4,}/i, "An ID number (MRN, PhilHealth, SSS…)."],
    [/(\+63|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/, "A phone number."],
    [/\b(born|birth\s*date|birthday|date of birth|DOB|kapanganakan)\b[^.\n]{0,20}\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/i, "An exact date of birth — the age is enough."],
    [/\b(born|birth\s*date|birthday|date of birth|DOB)\b[^.\n]{0,20}\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i, "An exact date of birth — the age is enough."],
    [/\b(Brgy|Barangay|Purok|Sitio|Blk|Block|Lot|Subd|Subdivision)\.?\s+[A-Z0-9]/i, "An address — the town or province is enough, or leave it out."],
    [/\b\d+\s+[A-Z][a-z]+\s+(Street|St\.|Avenue|Ave\.|Road|Rd\.)/, "A street address."],
    [/[\w.+-]+@[\w-]+\.[\w.]+/, "An email address."],
  ];
  for (const [re, message] of checks) if (re.test(text)) found.add(message);
  return [...found];
}

export const factsText = (facts: Facts) =>
  FACT_FIELDS.map((f) => (facts[f.key]?.trim() ? `${f.label}:\n${facts[f.key]!.trim()}` : "")).filter(Boolean).join("\n\n");

/** Template headings from an uploaded school template: short lines that look like headings. */
export function headingsFromTemplate(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const raw of lines) {
    const NUMBER = /^((([IVXLC]+|[A-Z])[.)])|(\d+(\.\d+)*[.)]?))\s+/;
    const numbered = NUMBER.test(raw);
    const line = raw.replace(NUMBER, "").replace(/[:.]$/, "").trim();
    if (line.length < 3 || line.length > 80) continue;
    const titleLike = /^[A-Z]/.test(line) && !/[.!?]\s/.test(line) && line.split(" ").length <= 10;
    const allCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
    if ((numbered && titleLike) || allCaps) {
      const nice = allCaps ? line.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : line;
      if (!out.some((o) => o.toLowerCase() === nice.toLowerCase())) out.push(nice);
    }
  }
  return out.slice(0, 30);
}

export const missingCount = (sections: Section[]) => sections.reduce((n, s) => n + (s.content.match(/\[MISSING[^\]]*\]/gi)?.length ?? 0), 0);
