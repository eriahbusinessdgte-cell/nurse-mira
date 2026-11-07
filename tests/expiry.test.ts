import { test } from "node:test";
import assert from "node:assert/strict";
import { chatDaysLeft, expiryLabel } from "../src/lib/tutor/expiry.ts";

const now = new Date("2026-11-30T12:00:00Z").getTime();
test("days left before an un-kept chat is deleted", () => {
  assert.equal(chatDaysLeft("2026-11-30T11:00:00Z", now), 30);
  assert.equal(chatDaysLeft("2026-11-20T12:00:00Z", now), 20);
  assert.equal(chatDaysLeft("2026-10-01T12:00:00Z", now), 0);
  assert.equal(expiryLabel(true, "2026-10-01T12:00:00Z", now), "Kept");
  assert.equal(expiryLabel(false, "2026-11-20T12:00:00Z", now), "Deletes in 20 days unless kept");
  assert.equal(expiryLabel(false, "2026-10-31T13:00:00Z", now), "Deletes within a day unless kept");
});
