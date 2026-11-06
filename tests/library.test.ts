import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPages, cleanText } from "../src/lib/library/chunk.ts";
import { suggestMetadata, titleFromFilename } from "../src/lib/library/suggest.ts";

test("cleanText joins hyphenated breaks and tidies spaces", () => {
  assert.equal(cleanText("pre-\neclampsia   is \n\n\n\n serious"), "preeclampsia is\n\nserious");
});

test("chunkPages keeps page numbers and splits long pages with overlap", () => {
  const long = "Sentence about heart failure and edema. ".repeat(80); // ~3,200 chars
  const chunks = chunkPages([
    { page: 1, text: long },
    { page: 2, text: "Short note." },
    { page: 3, text: "Another short page about digoxin toxicity signs and monitoring for the nurse. ".repeat(5) },
  ]);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].page_number, 1);
  assert.ok(chunks.every((c, i) => c.chunk_index === i));
  assert.ok(chunks.every((c) => c.content.length <= 1200));
  // short page 2 is merged into page 3's piece rather than dropped
  assert.ok(chunks.some((c) => c.content.includes("Short note.") && c.page_number === 3));
});

test("chunkPages ignores empty pages", () => {
  assert.deepEqual(chunkPages([{ page: 1, text: "   " }]), []);
});

const subjects = [
  { id: "s106", code: "NCM 106", title: "Pharmacology", year_level: 2, semester: 1 },
  { id: "s109", code: "NCM 109", title: "Care of Mother, Child at Risk or with Problems (Acute and Chronic)", year_level: 2, semester: 2 },
  { id: "smc1", code: "MC 1", title: "Anatomy and Physiology", year_level: 1, semester: 1 },
];
const topics = [{ id: "t1", subject_id: "s109", name: "Preeclampsia" }];

test("title from file name", () => {
  assert.equal(titleFromFilename("ncm-109_preeclampsia reviewer.pdf"), "NCM 109 Preeclampsia Reviewer");
});

test("suggests subject from a code in the file name", () => {
  const s = suggestMetadata("NCM106 drug notes.docx", "", subjects, topics);
  assert.equal(s.subject_id, "s106");
  assert.equal(s.year_level, 2);
  assert.equal(s.semester, 1);
});

test("suggests subject and topic from a topic mentioned in the text", () => {
  const s = suggestMetadata("reviewer.pdf", "Preeclampsia is hypertension after 20 weeks…", subjects, topics);
  assert.equal(s.subject_id, "s109");
  assert.equal(s.topic_id, "t1");
});

test("suggests subject from title words", () => {
  const s = suggestMetadata("notes.pdf", "Anatomy and physiology of the heart", subjects, topics);
  assert.equal(s.subject_id, "smc1");
});

test("no confident match leaves fields empty", () => {
  const s = suggestMetadata("random.pdf", "Grocery list", subjects, topics);
  assert.equal(s.subject_id, null);
  assert.equal(s.topic_id, null);
});
