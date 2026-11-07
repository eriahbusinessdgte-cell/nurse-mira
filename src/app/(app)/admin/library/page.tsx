import { Suspense } from "react";
import { DocumentList } from "@/components/document-list";
import { PageLoading } from "@/components/page-loading";
import { TextbookDialog } from "@/components/textbook-dialog";
import { UploadDialog } from "@/components/upload-dialog";
import { Card, PageHeader } from "@/components/ui";
import { DOC_COLUMNS, loadCurriculum, type FullDoc } from "@/lib/library/data";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Shared Library · Nurse Mira" };

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function AdminLibrary({ searchParams }: PageProps<"/admin/library">) {
  const { supabase, profile } = await requireProfile("admin");
  const p = await searchParams;
  const f = {
    q: pick(p.q).trim().slice(0, 80),
    subject: pick(p.subject),
    year: pick(p.year),
    semester: pick(p.semester),
    uploader: pick(p.uploader),
    status: pick(p.status) || "active",
    processing: pick(p.processing),
  };

  const { subjects, topics } = await loadCurriculum(supabase);
  const [{ data: people }, { data: all }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("documents").select("id, sha256, title, visibility").eq("visibility", "shared"),
  ]);
  const names = new Map((people ?? []).map((x) => [x.id, x.full_name || x.email]));

  let query = supabase.from("documents").select(DOC_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (f.q) query = query.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);
  if (f.subject) query = query.eq("subject_id", f.subject);
  if (f.year) query = query.eq("year_level", Number(f.year));
  if (f.semester) query = query.eq("semester", Number(f.semester));
  if (f.uploader) query = query.eq("uploader_id", f.uploader);
  if (f.status !== "all") query = query.eq("status", f.status);
  if (f.processing) query = query.eq("processing", f.processing);
  const { data, error } = await query.returns<FullDoc[]>();
  const docs = (data ?? []).map((d) => ({ ...d, uploader_name: d.uploader_id ? names.get(d.uploader_id) ?? null : null }));

  // Duplicates: identical files in the shared library.
  const bySha = new Map<string, string[]>();
  for (const d of all ?? []) bySha.set(d.sha256, [...(bySha.get(d.sha256) ?? []), d.title]);
  const duplicates = [...bySha.values()].filter((titles) => titles.length > 1);

  const select = "rounded-lg border border-mira-line bg-white px-3 py-2 text-sm";

  return (
    <>
      <PageHeader
        title="Shared Library"
        description="Every upload from every student lands here and helps Nurse Mira answer all students. Archive old semesters, control downloads, and remove anything inappropriate."
        action={
          <div className="flex flex-wrap gap-2">
            <TextbookDialog />
            <UploadDialog subjects={subjects} topics={topics} label="Upload reviewer" />
          </div>
        }
      />

      {duplicates.length > 0 && (
        <Card className="mb-4 !bg-amber-50 ring-amber-200">
          <h2 className="font-semibold text-amber-900">Possible duplicates</h2>
          <p className="mb-2 text-sm text-amber-900">These shared documents are the exact same file. You can delete the extra copies to save space.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {duplicates.map((titles, i) => (
              <li key={i}>{titles.map((t) => `“${t}”`).join(" = ")}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input type="search" name="q" defaultValue={f.q} placeholder="Search titles" aria-label="Search titles" className={`${select} lg:col-span-2`} />
          <select name="subject" defaultValue={f.subject} aria-label="Subject" className={select}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <select name="uploader" defaultValue={f.uploader} aria-label="Uploader" className={select}>
            <option value="">Anyone</option>
            {(people ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.full_name || x.email}
              </option>
            ))}
          </select>
          <select name="year" defaultValue={f.year} aria-label="Year level" className={select}>
            <option value="">All years</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                {YEAR_LABEL[y]}
              </option>
            ))}
          </select>
          <select name="semester" defaultValue={f.semester} aria-label="Semester" className={select}>
            <option value="">Both semesters</option>
            {[1, 2].map((s) => (
              <option key={s} value={s}>
                {SEM_LABEL[s]}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={f.status} aria-label="Status" className={select}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">Active and archived</option>
          </select>
          <select name="processing" defaultValue={f.processing} aria-label="Processing" className={select}>
            <option value="">Any processing status</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="failed">Needs attention</option>
          </select>
          <button type="submit" className="rounded-lg bg-mira-blue px-3 py-2 text-sm font-medium text-white hover:bg-mira-blue-dark sm:col-span-2 lg:col-span-1">
            Apply filters
          </button>
        </form>

        {error ? (
          <p className="text-sm text-mira-danger">Couldn&apos;t load documents. Please refresh the page.</p>
        ) : (
          <DocumentList
            docs={docs}
            mode="admin"
            subjects={subjects}
            topics={topics}
            currentUserId={profile.id}
            emptyTitle="No documents match"
            emptyText="Try changing the filters, or upload the first reviewer."
          />
        )}
      </Card>
    </>
  );
}

export default function Page(props: PageProps<"/admin/library">) {
  return (
    <Suspense fallback={<PageLoading label="Loading the shared library…" />}>
      <AdminLibrary {...props} />
    </Suspense>
  );
}
