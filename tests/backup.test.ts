import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileName, daysSince, lockBackup, restoreBatches, unlockBackup, type BackupData } from "../src/lib/backup/format.ts";

const sample: BackupData = {
  app: "nurse-mira",
  version: 1,
  created_at: "2026-11-06T00:00:00Z",
  tables: { subjects: [{ id: "a", name: "Pharmacology — ñ" }], messages: [] },
};

test("backup locks and unlocks with the right password", async () => {
  const file = await lockBackup(sample, "correct horse battery");
  assert.equal(new TextDecoder().decode(file.slice(0, 4)), "NMB1");
  assert.ok(!new TextDecoder().decode(file).includes("Pharmacology"));
  assert.deepEqual(await unlockBackup(file, "correct horse battery"), sample);
});

test("wrong password or wrong file is refused", async () => {
  const file = await lockBackup(sample, "correct horse battery");
  await assert.rejects(unlockBackup(file, "wrong password!"), /doesn't open/);
  await assert.rejects(unlockBackup(new TextEncoder().encode("hello world, not a backup at all"), "x"), /isn't a Nurse Mira/);
});

test("text pieces stay together per document", () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({ document_id: "d1", chunk_index: i })),
    ...Array.from({ length: 4 }, (_, i) => ({ document_id: "d2", chunk_index: i })),
    { document_id: "d3", chunk_index: 0 },
  ];
  const batches = restoreBatches("document_chunks", rows, 6);
  assert.deepEqual(batches.map((b) => b.length), [5, 5]);
  for (const b of batches) for (const d of ["d1", "d2", "d3"]) {
    const n = b.filter((r) => r.document_id === d).length;
    assert.ok(n === 0 || n === rows.filter((r) => r.document_id === d).length);
  }
  assert.deepEqual(restoreBatches("quizzes", Array.from({ length: 7 }, () => ({})), 3).map((b) => b.length), [3, 3, 1]);
});

test("file name uses the Philippine date, and days since", () => {
  assert.equal(backupFileName(new Date("2026-11-05T17:00:00Z")), "nurse-mira-backup-2026-11-06.nmb");
  assert.equal(daysSince(null), null);
  assert.equal(daysSince("2026-11-01T00:00:00Z", new Date("2026-11-08T01:00:00Z").getTime()), 7);
});
