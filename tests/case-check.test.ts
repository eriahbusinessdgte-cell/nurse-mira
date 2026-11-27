import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFormat, factGuard, isHeading, makeParts, PART_CHARS, splitIntoSections, stripEchoedTitle } from "../supabase/functions/case-check/split.ts";
import { wordDiff } from "../src/lib/case/diff.ts";

const CHN = `CHAPTER 1
Family Assessment
B. Socio-economic and Cultural Factors
The household currently has 3 members of the family living together.
C. Home and Environment Assessment
The client's home is located in a rural community.
D. Physical Assessment
1. Gordon's Functional Health Pattern
HEALTH PERCEPTION - HEALTH MANAGEMENT
● The patient has a history of Diabetes Mellitus.
CHAPTER 2
First Level Assessment
Risk for stroke — HEALTH THREAT. Frequent intake of processed foods. Health deficit and foreseeable crisis listed too.
CHAPTER 4
Scale of Ranking Criteria
Nature of the problem, modifiability, preventive potential, salience.
CHAPTER 7
Drug Study
Catapres (Clonidine) 75 mcg OD.`;

test("headings: chapters, lettered and known section names; not bullets or sentences", () => {
  for (const h of ["CHAPTER 1", "B. Socio-economic and Cultural Factors", "Drug Study", "NURSING CARE PLAN", "## Pathophysiology", "IV. Pathophysiology", "Discharge Plan:"]) assert.ok(isHeading(h), h);
  for (const h of ["● The patient has a history of Diabetes Mellitus.", "The household currently has 3 members.", "Temp: 36.8 C"]) assert.equal(isHeading(h), false, h);
});

test("a CHN case splits into its chapters and parts", () => {
  const s = splitIntoSections(CHN);
  const titles = s.map((x) => x.title);
  assert.ok(titles.includes("Chapter 1 – Family Assessment – B. Socio-economic and Cultural Factors"), titles.join(" | "));
  assert.ok(titles.some((t) => t.startsWith("D. Physical Assessment")));
  assert.ok(titles.some((t) => t.includes("Drug Study")));
  assert.ok(s.find((x) => x.title.startsWith("D. Physical"))!.original.includes("HEALTH PERCEPTION"), "sub-headings stay inside their section");
  assert.equal(detectFormat(CHN), "chn");
  assert.equal(detectFormat("Introduction\nPatient A was admitted for pneumonia.\nNursing Care Plan\n..."), "hospital");
});

test("text without headings stays one section; long sections are split for the AI", () => {
  assert.deepEqual(splitIntoSections("Just some text about a patient.").map((s) => s.title), ["Case study"]);
  const long = "Pathophysiology\n" + Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ` + "x".repeat(300)).join("\n\n");
  const s = splitIntoSections(long);
  assert.ok(s.length >= 2 && s.every((x) => x.original.length <= PART_CHARS));
  assert.equal(s[1].title, "Pathophysiology (continued)");
  const parts = makeParts(s);
  assert.ok(parts.every((p) => p.sections.reduce((n, i) => n + s[i].original.length, 0) <= PART_CHARS + 200));
  assert.equal(parts.flatMap((p) => p.sections).length, s.length);
});

test("word diff marks additions and removals", () => {
  const d = wordDiff("The patient has hypertension.", "The patient has stage 2 hypertension.");
  assert.equal(d.filter((x) => x.t === "add").map((x) => x.s).join("").trim(), "stage 2");
  assert.equal(d.filter((x) => x.t === "del").length, 0);
  const e = wordDiff("Clopidrogel 75 mg", "Clopidogrel 75 mg");
  assert.ok(e.some((x) => x.t === "del" && x.s.includes("Clopidrogel")) && e.some((x) => x.t === "add" && x.s.includes("Clopidogrel")));
});

test("fact guard: keeps numbers and fact words", () => {
  assert.equal(factGuard("BP 120/80, earns PHP15,000", "Blood pressure: 120/80 mmHg; earns PHP 15000"), null);
  assert.equal(factGuard("eats 3 meals", "eats three meals"), null);
  assert.match(factGuard("underwent an amputation in 2019", "underwent a lower-limb amputation in 2019") ?? "", /side or part of the body/);
  assert.match(factGuard("The patient is widowed.", "The patient is married.") ?? "", /widowed|married/);
  assert.match(factGuard("Temp 36.8, PR 86", "Temp 36.8") ?? "", /86/);
  assert.equal(factGuard("20/70 left eye", "20/70 (left eye); aim to lower sodium"), null);
});

test("strip echoed title", () => {
  assert.equal(stripEchoedTitle("History of Present Illness", "History of Present Illness\n● Text"), "● Text");
  assert.equal(stripEchoedTitle("Chapter 7 – Drug Study", "Drug Study:\nClopidogrel"), "Clopidogrel");
  assert.equal(stripEchoedTitle("Reference", "Smith 2020"), "Smith 2020");
});
