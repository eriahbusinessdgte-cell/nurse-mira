"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup, Download, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { retryIndexing } from "@/lib/library/upload";
import {
  BackupError,
  MIN_PASSWORD,
  TABLE_LABEL,
  TABLE_ORDER,
  backupFileName,
  daysSince,
  lockBackup,
  restoreBatches,
  unlockBackup,
  type BackupData,
  type Row,
  type TableName,
} from "@/lib/backup/format";

type Counts = { table: TableName; in_backup: number; missing: number; added: number; failed: number; note?: string };

async function call(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("backup", { body });
  if (error || !data || data.error) {
    let message = data?.error as string | undefined;
    if (!message && error) {
      try {
        message = (await (error as { context?: Response }).context?.json())?.error;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message ?? "The connection dropped. Please try again.");
  }
  return data;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}

export function BackupTools({ lastBackupAt }: { lastBackupAt: string | null }) {
  const router = useRouter();
  const [last, setLast] = useState(lastBackupAt);
  const age = daysSince(last);

  // Make a backup
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [making, setMaking] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [makeError, setMakeError] = useState<string | null>(null);

  async function makeBackup() {
    setMakeError(null);
    setMade(null);
    try {
      const data: BackupData = { app: "nurse-mira", version: 1, created_at: new Date().toISOString(), tables: {} };
      for (const [i, table] of TABLE_ORDER.entries()) {
        setMaking(`Copying ${TABLE_LABEL[table].toLowerCase()} (${i + 1} of ${TABLE_ORDER.length})`);
        const rows: Row[] = [];
        for (let offset = 0; ; offset += 1000) {
          const page = await call({ action: "export", table, offset });
          rows.push(...(page.rows as Row[]));
          if (!page.more) break;
        }
        data.tables[table] = rows;
      }
      setMaking("Locking the file with your password");
      const file = await lockBackup(data, pw);
      const name = backupFileName();
      const url = URL.createObjectURL(new Blob([file as BlobPart], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const done = await call({ action: "done" });
      setLast(done.last_backup_at);
      const total = Object.values(data.tables).reduce((n, r) => n + (r?.length ?? 0), 0);
      setMade(`Saved “${name}” to your Downloads (${total.toLocaleString()} records, ${(file.length / 1024 / 1024).toFixed(1)} MB).`);
      setPw("");
      setPw2("");
      router.refresh();
    } catch (e) {
      setMakeError((e as Error).message);
    } finally {
      setMaking(null);
    }
  }

  // Check or restore
  const [file, setFile] = useState<File | null>(null);
  const [rpw, setRpw] = useState("");
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [counts, setCounts] = useState<Counts[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  async function run(dry: boolean, data: BackupData) {
    const result: Counts[] = [];
    const reindex: string[] = [];
    for (const table of TABLE_ORDER) {
      const rows = data.tables[table] ?? [];
      const c: Counts = { table, in_backup: rows.length, missing: 0, added: 0, failed: 0 };
      for (const [i, batch] of restoreBatches(table, rows).entries()) {
        setRestoring(`${dry ? "Comparing" : "Putting back"} ${TABLE_LABEL[table].toLowerCase()}${rows.length > 800 ? ` (part ${i + 1})` : ""}`);
        const r = await call({ action: "restore", table, rows: batch, dry_run: dry });
        c.missing += r.missing;
        c.added += r.added;
        c.failed += r.failed;
        if (r.note) c.note = r.note;
        reindex.push(...(r.reindex ?? []));
      }
      result.push(c);
    }
    return { result, reindex };
  }

  async function check() {
    if (!file) return;
    setRestoreError(null);
    setCounts(null);
    setRestored(false);
    try {
      setRestoring("Opening the backup");
      const data = await unlockBackup(new Uint8Array(await file.arrayBuffer()), rpw);
      setBackup(data);
      const { result } = await run(true, data);
      setCounts(result);
    } catch (e) {
      setBackup(null);
      setRestoreError(e instanceof BackupError ? e.message : (e as Error).message);
    } finally {
      setRestoring(null);
    }
  }

  async function restore() {
    if (!backup) return;
    setRestoreError(null);
    try {
      const { result, reindex } = await run(false, backup);
      setCounts(result);
      for (const [i, id] of reindex.entries()) {
        setRestoring(`Rebuilding library search (${i + 1} of ${reindex.length})`);
        try {
          await retryIndexing(id, () => {});
        } catch {
          /* it stays marked — the Retry button in the library finishes it */
        }
      }
      setRestored(true);
      router.refresh();
    } catch (e) {
      setRestoreError((e as Error).message);
    } finally {
      setRestoring(null);
    }
  }

  const missingTotal = counts?.reduce((n, c) => n + c.missing, 0) ?? 0;
  const pwOk = pw.length >= MIN_PASSWORD && pw === pw2;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <DatabaseBackup size={18} aria-hidden /> Download a backup
        </h2>
        <p className={`mt-1 text-sm ${age === null || age > 7 ? "text-amber-700" : "text-mira-muted"}`}>
          {last ? `Last backup: ${when(last)}${age !== null && age > 7 ? ` — ${age} days ago, time for a new one.` : "."}` : "No backup has been made yet."}
        </p>
        <p className="mt-3 text-sm text-mira-muted">
          Includes students, subjects, the library&apos;s text, tutor chats, study sheets, quizzes, case studies, care plans and planners.
          The original uploaded files (PDFs, photos) aren&apos;t included — their text is. The file is locked, and Nurse Mira has no
          screen for reading what&apos;s inside: it is only for putting things back.
        </p>
        <div className="mt-4 space-y-2">
          <label className="block text-sm font-medium" htmlFor="bpw">
            Backup password (at least {MIN_PASSWORD} characters)
          </label>
          <input id="bpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} />
          <label className="block text-sm font-medium" htmlFor="bpw2">
            Type it again
          </label>
          <input id="bpw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputClass} />
          {pw2 && pw !== pw2 && <p className="text-sm text-mira-danger">The two passwords don&apos;t match.</p>}
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden />
            Keep this password somewhere safe (a password manager or written down at home). If it&apos;s lost, the backup can&apos;t be
            opened by anyone — not even by Nurse Mira.
          </p>
          <button type="button" onClick={makeBackup} disabled={!pwOk || !!making} className={buttonClass("primary", "w-full")}>
            <Download size={16} aria-hidden /> {making ?? "Make and download a backup"}
          </button>
          {made && (
            <p role="status" className="text-sm text-green-700">
              ✓ {made} Keep a copy somewhere other than this computer too, such as your Google Drive.
            </p>
          )}
          {makeError && (
            <p role="alert" className="text-sm text-mira-danger">
              {makeError}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} aria-hidden /> Check or restore a backup
        </h2>
        <p className="mt-1 text-sm text-mira-muted">
          Checking is safe: it opens the file on this device and compares it with the app — nothing changes. If something was lost, you
          can then put back only the missing records. Nothing that exists now is changed or removed.
        </p>
        <div className="mt-4 space-y-2">
          <label className="block text-sm font-medium" htmlFor="bfile">
            Backup file (.nmb)
          </label>
          <input
            id="bfile"
            type="file"
            accept=".nmb"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setBackup(null);
              setCounts(null);
              setRestored(false);
            }}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mira-blue-soft file:px-3 file:py-2 file:text-mira-blue"
          />
          <label className="block text-sm font-medium" htmlFor="rpw">
            Its backup password
          </label>
          <input id="rpw" type="password" autoComplete="off" value={rpw} onChange={(e) => setRpw(e.target.value)} className={inputClass} />
          <button type="button" onClick={check} disabled={!file || !rpw || !!restoring} className={buttonClass("secondary", "w-full")}>
            <ShieldCheck size={16} aria-hidden /> {restoring && !counts ? restoring : "Check this backup"}
          </button>
          {restoreError && (
            <p role="alert" className="text-sm text-mira-danger">
              {restoreError}
            </p>
          )}
        </div>

        {counts && backup && (
          <div className="mt-4">
            <p className="text-sm">
              Backup made <strong>{when(backup.created_at)}</strong>.{" "}
              {restored
                ? "Restore finished."
                : missingTotal === 0
                  ? "✓ Everything in it is still in the app — nothing needs restoring."
                  : `${missingTotal.toLocaleString()} record(s) in the backup are missing from the app.`}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-mira-muted">
                  <tr>
                    <th className="py-1 pr-2 font-medium">What</th>
                    <th className="py-1 pr-2 text-right font-medium">In backup</th>
                    <th className="py-1 text-right font-medium">{restored ? "Put back" : "Missing now"}</th>
                  </tr>
                </thead>
                <tbody>
                  {counts
                    .filter((c) => c.in_backup > 0)
                    .map((c) => (
                      <tr key={c.table} className="border-t border-mira-line">
                        <td className="py-1 pr-2">
                          {TABLE_LABEL[c.table]}
                          {c.note && <span className="block text-xs text-amber-700">{c.note}</span>}
                          {restored && c.failed > 0 && <span className="block text-xs text-mira-danger">{c.failed} couldn&apos;t be put back</span>}
                        </td>
                        <td className="py-1 pr-2 text-right">{c.in_backup.toLocaleString()}</td>
                        <td className={`py-1 text-right ${(restored ? c.added : c.missing) ? "font-semibold" : "text-mira-muted"}`}>
                          {(restored ? c.added : c.missing).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!restored && missingTotal > 0 && (
              <button type="button" onClick={restore} disabled={!!restoring} className={buttonClass("primary", "mt-3 w-full")}>
                <RotateCcw size={16} aria-hidden /> {restoring ?? `Put back the ${missingTotal.toLocaleString()} missing record(s)`}
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
