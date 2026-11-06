import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPlan, fromLines, normalizePlan, planTitle, planToMarkdown } from "../src/lib/ncp/plan.ts";

test("plan titles and normalising", () => {
  assert.equal(planTitle({ ...emptyPlan(), diagnosis: "Acute pain related to increased BP as evidenced by headache" }), "Acute pain");
  assert.equal(planTitle(emptyPlan()), "Untitled care plan");
  const p = normalizePlan({ diagnosis: "x" });
  assert.equal(p.interventions.length, 1);
  assert.deepEqual(p.assessment.objective, []);
});

test("list editing and export", () => {
  assert.deepEqual(fromLines("- BP 170/110\n• +3 edema"), ["BP 170/110", "+3 edema"]);
  const md = planToMarkdown({ ...emptyPlan(), diagnosis: "Acute pain", interventions: [{ action: "Assess | pain", rationale: "Baseline", kind: "independent" }] });
  assert.match(md, /\| 1 \| Assess \/ pain \| Independent \| Baseline \|/);
  assert.match(md, /### Evaluation/);
});
