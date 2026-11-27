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

import { isLongTask, isTask } from "../supabase/functions/tutor/prompt.ts";

test("requests to produce or change something are tasks", () => {
  for (const q of [
    "Create an introduction for our case study about ectopic pregnancy.",
    "Make it longer.",
    "Add the importance of nursing management.",
    "Now create three objectives for this case.",
    "Summarize this PDF",
    "Improve this NCP",
    "Make this more academic",
    "Correct the grammar",
    "Create 20 questions with answers and rationales.",
    "How can you make my reflection sound more natural?",
  ]) assert.ok(isTask(q), q);
});

test("plain questions aren't tasks", () => {
  for (const q of ["Explain ectopic pregnancy in simple terms.".replace("Explain", "What is"), "What is the correct dose of paracetamol?", "Why is answer B correct?", "Is furosemide a loop diuretic?"]) {
    assert.equal(isTask(q), false, q);
  }
});

test("long outputs get more room", () => {
  for (const q of ["Create a comprehensive reviewer about ectopic pregnancy", "Create 30 questions with answers and rationales", "Make it longer.", "Write a presentation script"]) assert.ok(isLongTask(q), q);
  assert.equal(isLongTask("Create an introduction for our case study"), false);
});
