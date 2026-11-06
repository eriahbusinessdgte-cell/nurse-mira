import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPages, cleanText } from "../src/lib/library/chunk.ts";
import { rebuildText } from "../src/lib/library/typed-copy.ts";

test("typed copy rebuilds each page's text without the repeated overlaps", () => {
  const sentence = (i: number) => `Sentence number ${i} explains a pharmacology idea about drug action and nursing care. `;
  const page1 = Array.from({ length: 40 }, (_, i) => sentence(i)).join("");
  const page2 = Array.from({ length: 30 }, (_, i) => sentence(100 + i)).join("");
  const chunks = chunkPages([{ page: 1, text: page1 }, { page: 2, text: page2 }]);
  assert.ok(chunks.length > 3);
  const sections = rebuildText(chunks);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].text.replace(/\s+/g, " ").trim(), cleanText(page1).replace(/\s+/g, " ").trim());
  assert.equal(sections[1].text.replace(/\s+/g, " ").trim(), cleanText(page2).replace(/\s+/g, " ").trim());
});
