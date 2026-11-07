import { test } from "node:test";
import assert from "node:assert/strict";
import { asksAboutPastStudy } from "../supabase/functions/tutor/prompt.ts";

test("past-study questions use the study history", () => {
  for (const q of ["Where did we leave off?", "where we left off yesterday", "What did I study last time?", "Give me a recap of my study", "What should I study next?", "Continue studying from last session"]) {
    assert.ok(asksAboutPastStudy(q), q);
  }
});

test("ordinary questions don't", () => {
  for (const q of ["What is the Bluebird Seven check?", "Explain heart failure", "What should I do before taking vital signs?", "Quiz me on insulin", "What is the Glasgow Coma Scale?"]) {
    assert.equal(asksAboutPastStudy(q), false, q);
  }
});
