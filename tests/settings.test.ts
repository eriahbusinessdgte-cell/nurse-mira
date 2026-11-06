import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSettings, pagesFor, readSettings, shareFor } from "../src/lib/settings.ts";

const good = { daily_answer_pool: "90", daily_answer_minimum: "5", page_reading_budget: "6,500", default_tutor_mode: "tea" };

test("valid settings pass and are converted to numbers", () => {
  const r = checkSettings(good);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.settings, { daily_answer_pool: 90, daily_answer_minimum: 5, page_reading_budget: 6500, default_tutor_mode: "tea" });
});

test("out-of-range or odd values are refused with a plain message", () => {
  for (const bad of [
    { daily_answer_pool: "5" },
    { daily_answer_pool: "301" },
    { daily_answer_pool: "90.5" },
    { daily_answer_minimum: "0" },
    { daily_answer_pool: "20", daily_answer_minimum: "25" },
    { page_reading_budget: "10000" },
    { page_reading_budget: "-1" },
    { default_tutor_mode: "party" },
    { daily_answer_pool: "" },
  ]) {
    const r = checkSettings({ ...good, ...bad });
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
});

test("share matches the database rule, pages estimate", () => {
  assert.equal(shareFor(90, 5, 1), 90);
  assert.equal(shareFor(90, 5, 4), 22);
  assert.equal(shareFor(90, 5, 0), 90);
  assert.equal(shareFor(20, 5, 10), 5);
  assert.equal(pagesFor(6500), 76);
});

test("reading stored settings falls back to defaults", () => {
  assert.deepEqual(readSettings([{ key: "daily_answer_pool", value: 120 }, { key: "default_tutor_mode", value: "clinical" }]), {
    daily_answer_pool: 120,
    daily_answer_minimum: 5,
    page_reading_budget: 6500,
    default_tutor_mode: "clinical",
  });
});
