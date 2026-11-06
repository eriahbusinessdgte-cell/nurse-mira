import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Card, PageHeader } from "@/components/ui";
import { formatBytes } from "@/lib/library/labels";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";
import { ArchiveSemester, ExportLibrary, TextOnlyArchived } from "./storage-tools";

export const metadata = { title: "Storage · Nurse Mira" };

// Free-plan allowances (checked November 2026). Shown so the warnings mean something.
const FILE_LIMIT = 1024 ** 3; // 1 GB file storage
const DB_LIMIT = 500 * 1024 ** 2; // 500 MB database

type Doc = {
  id: string;
  title: string;
  file_size: number;
  file_path: string | null;
  status: "active" | "archived";
  visibility: "shared" | "private";
  year_level: number | null;
  semester: number | null;
  subject_id: string | null;
};

function Meter({ label, used, limit, note }: { label: string; used: number; limit: number; note: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  const level = pct >= 90 ? "critical" : pct >= 80 ? "high" : pct >= 70 ? "warn" : "ok";
  const bar = { ok: "bg-mira-blue", warn: "bg-amber-400", high: "bg-orange-500", critical: "bg-mira-danger" }[level];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-mira-muted">
          {formatBytes(used)} of {formatBytes(limit)}
        </p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-mira-line" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <p className="mt-2 text-sm">
        <strong>{pct < 1 ? "<1" : Math.round(pct)}% used.</strong>{" "}
        {level === "ok" && <span className="text-mira-muted">{note}</span>}
        {level === "warn" && <span className="text-amber-700">Over 70% — a good time to archive old semesters and remove duplicates.</span>}
        {level === "high" && <span className="text-orange-700">Over 80% — please free up space soon (see the tools below).</span>}
        {level === "critical" && <span className="text-mira-danger">Over 90% — new uploads may fail. Free up space now.</span>}
      </p>
    </Card>
  );
}

function Table({ rows }: { rows: [string, { bytes: number; count: number }][] }) {
  return rows.length === 0 ? (
    <p className="text-sm text-mira-muted">No files yet.</p>
  ) : (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-mira-line">
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="py-2">{k}</td>
            <td className="py-2 text-right text-mira-muted">{v.count} file(s)</td>
            <td className="py-2 text-right font-medium">{formatBytes(v.bytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Storage() {
  const { supabase } = await requireProfile("admin");
  const [{ data: stats, error: statsError }, { data: docs }, { data: subjects }] = await Promise.all([
    supabase.rpc("admin_storage_stats"),
    supabase.from("documents").select("id, title, file_size, file_path, status, visibility, year_level, semester, subject_id").returns<Doc[]>(),
    supabase.from("subjects").select("id, code"),
  ]);
  const s = (stats ?? { database_bytes: 0, file_bytes: 0, file_count: 0, index_bytes: 0 }) as {
    database_bytes: number;
    file_bytes: number;
    file_count: number;
    index_bytes: number;
  };
  const all = docs ?? [];
  const withFile = all.filter((d) => d.file_path);
  const code = new Map((subjects ?? []).map((x) => [x.id, x.code]));

  const group = (key: (d: Doc) => string) => {
    const m = new Map<string, { bytes: number; count: number }>();
    for (const d of withFile) {
      const k = key(d);
      const g = m.get(k) ?? { bytes: 0, count: 0 };
      g.bytes += Number(d.file_size);
      g.count++;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  };
  const bySemester = group((d) => (d.year_level && d.semester ? `${YEAR_LABEL[d.year_level]} · ${SEM_LABEL[d.semester]}` : "No semester"));
  const bySubject = group((d) => (d.subject_id ? code.get(d.subject_id) ?? "Unknown" : "No subject")).slice(0, 10);
  const largest = [...withFile].sort((a, b) => b.file_size - a.file_size).slice(0, 10);
  const archived = all.filter((d) => d.status === "archived");
  const archivedWithFiles = archived.filter((d) => d.visibility === "shared" && d.file_path);

  return (
    <>
      <PageHeader
        title="Storage"
        description="See what's using space on the free plan and free it up with a few clicks. Nothing is deleted automatically."
      />
      {statsError && <p className="mb-4 text-sm text-mira-danger">Couldn&apos;t read storage numbers right now. Please refresh.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Meter
          label="File storage (original uploads)"
          used={s.file_bytes}
          limit={FILE_LIMIT}
          note={`${s.file_count} file(s) stored. Plenty of room.`}
        />
        <Meter
          label="Database (records, text and search index)"
          used={s.database_bytes}
          limit={DB_LIMIT}
          note={`The library's text and search index use ${formatBytes(s.index_bytes)}.`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">By semester</h2>
          <Table rows={bySemester} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">By subject (top 10)</h2>
          <Table rows={bySubject} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Largest files</h2>
          {largest.length === 0 ? (
            <p className="text-sm text-mira-muted">No files yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {largest.map((d) => (
                <li key={d.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {d.title}
                    {d.visibility === "private" && <span className="text-mira-muted"> (private)</span>}
                  </span>
                  <span className="shrink-0 font-medium">{formatBytes(d.file_size)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-1 font-semibold">Archive a finished semester</h2>
          <p className="mb-3 text-sm text-mira-muted">
            Archived materials stay searchable by Nurse Mira (at lower priority) and can be restored any time.
          </p>
          <ArchiveSemester />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Free space from archived files</h2>
          <p className="mb-3 text-sm text-mira-muted">
            {archived.length} archived document(s).{" "}
            <Link href="/admin/library?status=archived" className="text-mira-blue underline">
              View archived
            </Link>
          </p>
          <TextOnlyArchived ids={archivedWithFiles.map((d) => d.id)} bytes={archivedWithFiles.reduce((n, d) => n + Number(d.file_size), 0)} />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Export / back up the library</h2>
          <p className="mb-3 text-sm text-mira-muted">Keep a copy on your computer. The free plan has no automatic backups.</p>
          <ExportLibrary />
        </Card>
      </div>

      <p className="mt-6 text-sm text-mira-muted">
        To delete specific documents or duplicates, use the{" "}
        <Link href="/admin/library" className="text-mira-blue underline">
          Shared Library
        </Link>{" "}
        page — select them and choose Delete. You&apos;ll see exactly what will be removed and how much space you&apos;ll get back first.
      </p>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Checking storage…" />}>
      <Storage />
    </Suspense>
  );
}
