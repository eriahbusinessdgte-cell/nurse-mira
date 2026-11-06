import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, bucket, formatTime, monthGrid } from "../src/lib/planner/plan.ts";

test("groups tasks by when they're due", () => {
  const today = "2026-11-06";
  assert.equal(bucket({ status: "todo", due_date: "2026-11-05" }, today), "overdue");
  assert.equal(bucket({ status: "todo", due_date: today }, today), "today");
  assert.equal(bucket({ status: "in_progress", due_date: "2026-11-13" }, today), "week");
  assert.equal(bucket({ status: "todo", due_date: "2026-11-14" }, today), "later");
  assert.equal(bucket({ status: "todo", due_date: null }, today), "nodate");
  assert.equal(bucket({ status: "done", due_date: "2026-11-01" }, today), "done");
});

test("calendar grid and helpers", () => {
  const nov = monthGrid(2026, 11); // Nov 1 2026 is a Sunday
  assert.equal(nov[0][0], "2026-11-01");
  assert.ok(nov.every((w) => w.length === 7));
  assert.equal(nov.flat().includes("2026-11-30"), true);
  const feb = monthGrid(2027, 2);
  assert.equal(feb[0][0] <= "2027-02-01", true);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(formatTime("13:05:00"), "1:05 PM");
  assert.equal(formatTime("00:30"), "12:30 AM");
});
