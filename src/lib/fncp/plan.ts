// Family Nursing Care Plan (D-067): shape, helpers and the PDF. Pure, unit-tested.
// The seven columns and their order are fixed (Erika's requirement) — don't change them without her approval.

export const COLUMNS = [
  ["family_problem", "Family Problem"],
  ["diagnosis", "Family Nursing Diagnosis"],
  ["goal", "Goal of Care"],
  ["objectives", "Objectives of Care"],
  ["responsibilities", "Nursing Responsibilities"],
  ["resources", "Resources"],
  ["evaluation", "Evaluation"],
] as const;

export type ColumnKey = (typeof COLUMNS)[number][0];
/** One row of the table = one family problem with its seven columns. */
export type PlanRow = Record<ColumnKey, string>;
/** A saved plan: one or more rows (the reference sample has one row per family problem). */
export type FamilyPlan = { rows: PlanRow[] };
export const DOC_TITLE = "FAMILY NURSING CARE PLAN";
export const MAX_ROWS = 4;

export const emptyRow = (): PlanRow => Object.fromEntries(COLUMNS.map(([k]) => [k, ""])) as PlanRow;
export const emptyPlan = (): FamilyPlan => ({ rows: [emptyRow()] });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRow(r: any): PlanRow {
  return Object.fromEntries(COLUMNS.map(([k]) => [k, typeof r?.[k] === "string" ? r[k] : ""])) as PlanRow;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePlan(p: any): FamilyPlan {
  const rows = Array.isArray(p?.rows) ? p.rows.slice(0, MAX_ROWS).map(normalizeRow) : [];
  return { rows: rows.length ? rows : [emptyRow()] };
}

export const isComplete = (p: FamilyPlan) => p.rows.every((r) => COLUMNS.every(([k]) => r[k].trim().length > 0));

/** A short name for the saved-plans list, taken from the student's description. */
export function titleFrom(input: string): string {
  const first = input.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const t = first.length > 90 ? `${first.slice(0, 87).replace(/\s+\S*$/, "")}…` : first;
  return t || "Untitled family care plan";
}

/** The built-in PDF fonts only cover basic Latin characters, so swap the few others the AI likes to use. */
export function pdfSafe(s: string): string {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[●▪‣⁃]/g, "•")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[→⇒]/g, "->")
    .replace(/×/g, "x")
    .replace(/[   ]/g, " ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .normalize("NFKC")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ•]/g, "");
}

export type PdfMeta = { situation: string; preparedBy?: string; date?: string };

/**
 * Builds the landscape PDF: title, the student's described situation, then the seven-column table.
 * Long cells wrap and continue onto the next page; the column headers repeat on every page.
 * `jsPDF` and `autoTable` are passed in so this works in the browser and in tests.
 */
export function buildFncpPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsPDF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable: any,
  plan: FamilyPlan,
  meta: PdfMeta,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(DOC_TITLE, pageW / 2, 40, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 58;
  const line = [meta.preparedBy ? `Prepared by: ${meta.preparedBy}` : "", meta.date ? `Date: ${meta.date}` : ""].filter(Boolean).join("     ");
  if (line) {
    doc.text(pdfSafe(line), margin, y);
    y += 14;
  }
  if (meta.situation.trim()) {
    const wrapped = doc.splitTextToSize(pdfSafe(`Situation: ${meta.situation.trim()}`), pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 11 + 6;
  }
  const usable = pageW - margin * 2;
  const share = [0.13, 0.14, 0.15, 0.15, 0.17, 0.12, 0.14]; // column widths, close to the reference sample
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 36, bottom: 30 },
    head: [COLUMNS.map(([, label]) => label)],
    body: plan.rows.map((r) => COLUMNS.map(([k]) => pdfSafe(r[k].trim()))),
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "auto",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, valign: "top", overflow: "linebreak", lineColor: [70, 70, 70], lineWidth: 0.6, textColor: [20, 20, 20] },
    headStyles: { fillColor: [33, 72, 192], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", valign: "middle", fontSize: 9 },
    columnStyles: Object.fromEntries(share.map((s, i) => [i, { cellWidth: usable * s }])),
    didDrawPage: () => {
      const n = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${n}`, pageW - margin, doc.internal.pageSize.getHeight() - 14, { align: "right" });
      doc.setTextColor(20);
    },
  });
  return doc;
}

export const pdfFileName = (title: string) => `FNCP - ${title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "family care plan"}.pdf`;
