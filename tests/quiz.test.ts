import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, isCorrect, weakTopics, type Question } from "../src/lib/quiz/grade.ts";

const qs: Question[] = [
  { id: "q1", type: "mcq", question: "?", options: ["a", "b", "c", "d"], answer: 2, rationale: "", topic: "RTIs" },
  { id: "q2", type: "multi", question: "?", options: ["a", "b", "c", "d", "e"], answer: [0, 3], rationale: "", topic: "RTIs" },
  { id: "q3", type: "tf", question: "?", answer: false, rationale: "", topic: "Purpose" },
  { id: "q4", type: "identification", question: "?", answer: "Zidovudine", accept: ["AZT"], rationale: "", topic: "Purpose" },
];

test("grades each question type", () => {
  assert.equal(isCorrect(qs[0], 2), true);
  assert.equal(isCorrect(qs[0], 1), false);
  assert.equal(isCorrect(qs[1], [3, 0]), true);
  assert.equal(isCorrect(qs[1], [0]), false);
  assert.equal(isCorrect(qs[1], [0, 3, 4]), false);
  assert.equal(isCorrect(qs[2], false), true);
  assert.equal(isCorrect(qs[2], true), false);
  assert.equal(isCorrect(qs[3], " zidovudine "), true);
  assert.equal(isCorrect(qs[3], "Zidovudin"), true); // one typo forgiven
  assert.equal(isCorrect(qs[3], "azt"), true);
  assert.equal(isCorrect(qs[3], "stavudine"), false);
  assert.equal(isCorrect(qs[3], ""), false);
});

test("score, topic breakdown and topics to improve", () => {
  const r = grade(qs, { q1: 2, q2: [0], q3: false, q4: "nevirapine" });
  assert.equal(r.score, 2);
  assert.equal(r.total, 4);
  assert.deepEqual(r.byTopic, { RTIs: { right: 1, total: 2 }, Purpose: { right: 1, total: 2 } });
  const weak = weakTopics([{ by_topic: r.byTopic }, { by_topic: { RTIs: { right: 0, total: 2 }, Purpose: { right: 2, total: 2 } } }]);
  assert.deepEqual(weak.map((w) => w.topic), ["RTIs"]);
  assert.equal(weak[0].percent, 25);
});
