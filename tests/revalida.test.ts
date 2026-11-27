import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, overlap, words, jaccard } from "../supabase/functions/revalida/similarity.ts";

test("same wording after normalising", () => {
  assert.equal(normalize("Why is monitoring Vital Signs important?"), normalize("why is monitoring vital signs important"));
});

test("the brief's paraphrase pair counts as a reworded repeat", () => {
  const a = words("Why is monitoring vital signs important for this patient?");
  const b = words("Explain the importance of monitoring the patient's vital signs.");
  assert.ok(overlap(a, b) >= 0.6, `overlap ${overlap(a, b)}`);
});

test("a different scenario on the same topic is not a repeat", () => {
  const a = words("Why is monitoring vital signs important for this patient?");
  const b = words("Your patient suddenly develops hypotension and tachycardia. What complication would you suspect, what would you assess, and what is your immediate nursing response?");
  assert.ok(overlap(a, b) < 0.6, `overlap ${overlap(a, b)}`);
});

test("slightly edited case text is recognised as the same case", () => {
  const base = "Patient A, 28 years old, G2P1, admitted for ruptured ectopic pregnancy. Complains of sharp left lower abdominal pain, vaginal spotting. BP 90/60, HR 118. Hgb 9.1. Underwent laparoscopic salpingectomy. Given ketorolac and cefazolin.";
  const edited = base + " Also given ferrous sulfate. Discharge planning done.";
  assert.ok(jaccard(words(base), words(edited)) >= 0.55);
  const other = "Patient B, 64 years old, admitted for community-acquired pneumonia with productive cough, fever 38.9, crackles on the right base, SpO2 91%, started on ceftriaxone and azithromycin.";
  assert.ok(jaccard(words(base), words(other)) < 0.55);
});

test("a short recall item doesn't block longer questions on the same disease", () => {
  const a = words("Define ectopic pregnancy.");
  const b = words("Explain how tubal rupture in ectopic pregnancy accounts for your patient's hypotension and tachycardia.");
  assert.ok(overlap(a, b) < 0.6, `overlap ${overlap(a, b)}`);
});

test("different nursing diagnoses asked the same way don't count as word-overlap repeats", () => {
  const a = words("If you identified 'Deficient fluid volume' as the priority nursing diagnosis, defend why it takes precedence over the other diagnoses and outline two specific interventions you would implement.");
  const b = words("If you identified 'Deficient knowledge related to postoperative care' as a nursing diagnosis, what would be your primary goal and two key interventions?");
  assert.ok(overlap(a, b) < 0.45, `overlap ${overlap(a, b)}`);
});
