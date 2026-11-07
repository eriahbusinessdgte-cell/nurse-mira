import { test } from "node:test";
import assert from "node:assert/strict";
import { greetingFor, firstName } from "../src/lib/greeting.ts";

const at = (h: number) => new Date(2026, 10, 6, h, 30);
const ana = { full_name: "Ana Reyes", role: "student" as const };

test("time of day", () => {
  assert.equal(greetingFor(ana, at(8)), "Good morning, Nurse Ana");
  assert.equal(greetingFor(ana, at(13)), "Good afternoon, Nurse Ana");
  assert.equal(greetingFor(ana, at(19)), "Good evening, Nurse Ana");
  assert.equal(greetingFor(ana, at(2)), "Good evening, Nurse Ana");
});
test("Nurse never doubled", () => {
  assert.equal(firstName("Nurse Ana Reyes"), "Ana");
  assert.equal(firstName("nurse. Ana"), "Ana");
  assert.equal(firstName("Test Student B", "Student B"), "Student B");
  assert.equal(firstName("Ana Marie Reyes", "  Ana   Marie "), "Ana Marie");
  assert.equal(firstName("Ana Reyes", "Nurse Annie"), "Annie");
  assert.equal(firstName("Ana Reyes", "   "), "Ana");
  assert.equal(greetingFor({ full_name: "Nurse Ana", role: "student" }, at(8)), "Good morning, Nurse Ana");
});
test("preferred name wins; admin has no Nurse", () => {
  assert.equal(greetingFor({ full_name: "Maria Ana Reyes", preferred_name: "Mia", role: "student" }, at(8)), "Good morning, Nurse Mia");
  assert.equal(greetingFor({ full_name: "Erika Angel Perez", role: "admin" }, at(8)), "Good morning, Erika");
});
