import { test } from "node:test";
import assert from "node:assert/strict";
import { PROVIDER_LABEL, dailyRows, providerTotals } from "../src/lib/usage.ts";

test("provider labels", () => {
  assert.equal(PROVIDER_LABEL("groq", "openai/gpt-oss-120b"), "Groq (main)");
  assert.equal(PROVIDER_LABEL("groq", "openai/gpt-oss-20b"), "Groq small model (last backup)");
  assert.equal(PROVIDER_LABEL("cloudflare", "@cf/openai/gpt-oss-120b"), "Cloudflare (backup)");
});

test("daily rows fill gaps and count backups", () => {
  const rows = dailyRows(
    ["2026-11-07", "2026-11-06"],
    [
      { day: "2026-11-07", student_id: "a", answers: 3 },
      { day: "2026-11-07", student_id: "b", answers: 2 },
    ],
    [{ day: "2026-11-07", neurons: 1234.6, pages: 4 }],
    [
      { day: "2026-11-07", provider: "groq", model: "openai/gpt-oss-120b", answers: 3 },
      { day: "2026-11-07", provider: "cloudflare", model: "x", answers: 1 },
    ],
  );
  assert.deepEqual(rows[0], { day: "2026-11-07", answers: 5, students: 2, units: 1235, pages: 4, backup: 1 });
  assert.deepEqual(rows[1], { day: "2026-11-06", answers: 0, students: 0, units: 0, pages: 0, backup: 0 });
  assert.deepEqual(providerTotals([
    { day: "d", provider: "groq", model: "openai/gpt-oss-120b", answers: 3 },
    { day: "e", provider: "groq", model: "openai/gpt-oss-120b", answers: 2 },
    { day: "d", provider: "cloudflare", model: "x", answers: 1 },
  ]), [{ label: "Groq (main)", answers: 5 }, { label: "Cloudflare (backup)", answers: 1 }]);
});
