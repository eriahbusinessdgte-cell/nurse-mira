import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeIndexPage, prepareTextbookPages, stripRepeatedLines } from "../src/lib/library/textbook.ts";

const TOPICS = ["temperature", "pulse", "respirations", "blood pressure", "oxygen saturation", "pain", "hygiene", "mobility", "nutrition", "elimination"];
const body = (n: number) =>
  `${"Teaching about " + TOPICS[n % 10] + " for client group " + "abcdefghijklmnopqrstuvwxyz"[n % 26]}: the nurse compares each value with the baseline of client ${"xyzw"[n % 4]}${"qrst"[n % 3]}.\nAccess for free at openstax.org\n${n}`;

test("repeated footers are removed, real text stays", () => {
  const pages = Array.from({ length: 30 }, (_, i) => ({ page: i + 1, text: body(i + 1) }));
  const out = stripRepeatedLines(pages);
  assert.ok(!out[3].text.includes("openstax.org"));
  assert.ok(out[3].text.includes("Teaching about"));
});

test("index and contents pages are detected", () => {
  const index = ["Index", "abdominal assessment, 412, 415", "acetaminophen, 233", "acid-base balance, 610–612", "activity intolerance, 98", "acute pain, 301, 305", "adrenal glands, 777", "advance directives, 45", "airway, 512, 514", "albumin, 620"].join("\n");
  const toc = ["Contents", "Preface 1", "Unit 1 Foundations", "1 Introduction to Nursing 9", "1.1 History 10", "1.2 Roles 14", "1.3 Ethics 20", "2 Communication 31", "2.1 Therapeutic 32", "2.2 Barriers 40"].join("\n");
  assert.equal(looksLikeIndexPage(index), true);
  assert.equal(looksLikeIndexPage(toc), true);
  assert.equal(looksLikeIndexPage(body(5).repeat(3)), false);
  const labs = ["Normal laboratory values", "Sodium 135–145", "Potassium 3.5–5.0", "Chloride 98–106", "Calcium 8.5–10.5", "Glucose 70–100", "BUN 10–20", "Creatinine 0.6–1.2", "Hemoglobin 12–16", "Platelets 150–400"].join("\n");
  assert.equal(looksLikeIndexPage(labs), false);
});

test("prepare keeps teaching pages and counts what was skipped", () => {
  const pages = [
    ...Array.from({ length: 20 }, (_, i) => ({ page: i + 1, text: body(i + 1) })),
    { page: 21, text: "" },
    { page: 22, text: ["Index", "a, 1", "b, 2", "c, 3", "d, 4", "e, 5", "f, 6", "g, 7", "h, 8", "i, 9"].join("\n") },
  ];
  const r = prepareTextbookPages(pages);
  assert.equal(r.pages.length, 20);
  assert.equal(r.skipped, 2);
});

import { isReferenceChunk } from "../src/lib/library/textbook.ts";
test("reference lists are recognised, normal text with one link is kept", () => {
  const refs = "DailyMed. (Updated June 2023). Linezolid injection. https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=08decdf3-a397-42e7-8ac3-e489c0cc7085 DailyMed. (Updated May 2022). Oseltamivir capsule. https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=80beab2c-396e-4a37-a4dc-40fdb62859cf";
  assert.equal(isReferenceChunk(refs), true);
  const normal = "Vancomycin is a glycopeptide antibiotic used for serious gram-positive infections. Monitor trough levels, renal function and hearing. The nurse infuses it slowly over at least 60 minutes to prevent infusion reactions (red man syndrome). Teach the client to report ringing in the ears. More information: https://www.cdc.gov".repeat(2);
  assert.equal(isReferenceChunk(normal), false);
});
