import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStudy, studyRows, studyTitle, studyToMarkdown } from "../src/lib/drug/study.ts";

test("normalizeStudy fills missing fields", () => {
  const s = normalizeStudy({ generic_name: "Ceftriaxone", indications: ["Pneumonia", 3] });
  assert.equal(s.generic_name, "Ceftriaxone");
  assert.deepEqual(s.indications, ["Pneumonia"]);
  assert.deepEqual(s.responsibilities, { before: [], during: [], after: [] });
});

test("title shows brand names in brackets", () => {
  assert.equal(studyTitle(normalizeStudy({ generic_name: "Paracetamol", brand_names: "Biogesic" })), "Paracetamol (Biogesic)");
  assert.equal(studyTitle(normalizeStudy({})), "Untitled drug");
});

test("markdown table keeps pipes and new lines out of cells", () => {
  const md = studyToMarkdown(normalizeStudy({ generic_name: "A|B", side_effects: ["nausea\nvomiting", ""], indication_for_patient: "fever" }));
  assert.match(md, /\| \*\*Generic name\*\* \| A\/B \|/);
  assert.match(md, /• nausea vomiting/);
  assert.match(md, /For this patient:\*\* fever/);
  assert.equal(studyRows(normalizeStudy({})).length, 14);
});
