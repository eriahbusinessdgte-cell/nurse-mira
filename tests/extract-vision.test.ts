import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The page reader must be tried before the free in-browser reader, and duplicates checked before reading.
test("upload checks duplicates before reading pages", () => {
  const src = readFileSync("src/components/upload-dialog.tsx", "utf8");
  assert.ok(src.indexOf("find_shared_duplicate") < src.indexOf("extractText(file"));
});

test("photo pages go to the handwriting reader first, free reader as fallback", () => {
  const src = readFileSync("src/lib/library/extract.ts", "utf8");
  const vision = src.indexOf("2a. Nurse Mira's page reader");
  const fallback = src.indexOf("2b. Anything left");
  assert.ok(vision > 0 && fallback > vision);
});
