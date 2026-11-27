import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMNS, isComplete, normalizePlan, pdfSafe, titleFrom } from "../src/lib/fncp/plan.ts";

test("seven columns in the required order", () => {
  assert.deepEqual(
    COLUMNS.map(([, l]) => l),
    ["Family Problem", "Family Nursing Diagnosis", "Goal of Care", "Objectives of Care", "Nursing Responsibilities", "Resources", "Evaluation"],
  );
});

test("normalizePlan keeps rows, fills gaps, never returns zero rows", () => {
  assert.equal(normalizePlan(null).rows.length, 1);
  const p = normalizePlan({ rows: [{ family_problem: "A", goal: 3 }, {}, {}, {}, {}, {}] });
  assert.equal(p.rows.length, 4);
  assert.equal(p.rows[0].family_problem, "A");
  assert.equal(p.rows[0].goal, "");
  assert.equal(isComplete(p), false);
});

test("pdfSafe replaces characters the built-in PDF font can't draw", () => {
  assert.equal(pdfSafe("“BP” ≥ 140 – check • daily → report…"), '"BP" >= 140 - check • daily -> report...');
  assert.equal(pdfSafe("health\u2011education, mosquito\u2010free"), "health-education, mosquito-free");
  assert.equal(pdfSafe("**bold** text"), "bold text");
});

test("titleFrom uses the first sentence, shortened", () => {
  assert.equal(titleFrom("Non-adherence to medication. More details here."), "Non-adherence to medication.");
  assert.ok(titleFrom("x ".repeat(80)).length <= 91);
  assert.equal(titleFrom("   "), "Untitled family care plan");
});
