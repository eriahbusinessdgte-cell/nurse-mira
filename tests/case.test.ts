import { test } from "node:test";
import assert from "node:assert/strict";
import { findIdentifiers, headingsFromTemplate, missingCount } from "../src/lib/case/facts.ts";

test("flags details that could identify a patient", () => {
  assert.equal(findIdentifiers("Patient A, 28-year-old female, G2P1, 34 weeks AOG, from Laguna.").length, 0);
  assert.ok(findIdentifiers("Mrs. Santos was admitted").length);
  assert.ok(findIdentifiers("Patient name: Juan").length);
  assert.ok(findIdentifiers("Hospital no. 2026-00123").length);
  assert.ok(findIdentifiers("Contact 0917 123 4567").length);
  assert.ok(findIdentifiers("Date of birth 03/14/1998").length);
  assert.ok(findIdentifiers("lives in Brgy. San Isidro").length);
  assert.ok(findIdentifiers("PhilHealth: 12-345678901-2").length);
});

test("reads section headings from a school template", () => {
  const text = "CASE STUDY FORMAT\nI. Introduction\nThis part describes the patient.\nII. Patient's Profile\nIII. Anatomy and Physiology\n3.1 Pathophysiology\nIV. NURSING CARE PLAN\nPlease write in complete sentences. Use APA style.";
  const h = headingsFromTemplate(text);
  assert.deepEqual(h, ["Case Study Format", "Introduction", "Patient's Profile", "Anatomy and Physiology", "Pathophysiology", "Nursing Care Plan"]);
});

test("counts missing-information markers", () => {
  assert.equal(missingCount([{ id: "a", title: "x", content: "BP [MISSING: blood pressure] and [missing: weight]" }]), 2);
});
