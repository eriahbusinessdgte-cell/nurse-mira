import Link from "next/link";
import { Suspense } from "react";
import { DocumentList } from "@/components/document-list";
import { PageLoading } from "@/components/page-loading";
import { UploadDialog } from "@/components/upload-dialog";
import { Card, PageHeader } from "@/components/ui";
import { DOC_COLUMNS, loadCurriculum, type FullDoc } from "@/lib/library/data";
import { requireStudent } from "@/lib/supabase/server";

export const metadata = { title: "My Library · Nurse Mira" };

async function Library({ searchParams }: PageProps<"/library">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const tab = params.tab === "shared" ? "shared" : "mine";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const subject = typeof params.subject === "string" ? params.subject : "";

  const { subjects, topics } = await loadCurriculum(supabase);

  let query = supabase.from("documents").select(DOC_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (tab === "mine") query = query.eq("uploader_id", profile.id);
  else query = query.eq("visibility", "shared").eq("status", "active").eq("processing", "ready");
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, " ")}%`);
  if (subject) query = query.eq("subject_id", subject);
  const { data, error } = await query.returns<FullDoc[]>();

  const tabs = [
    { key: "mine", label: "My uploads" },
    { key: "shared", label: "Shared library" },
  ];

  return (
    <>
      <PageHeader
        title="My Library"
        description="Upload reviewers to share with every Nurse Mira student, or keep private documents just for you."
        action={<UploadDialog subjects={subjects} topics={topics} label="Upload document" />}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="tablist">
            {tabs.map((t) => (
              <Link
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                href={{ pathname: "/library", query: { tab: t.key } }}
                className={`rounded-full px-4 py-1.5 text-sm ${tab === t.key ? "bg-mira-blue text-white" : "bg-mira-page text-mira-muted hover:text-mira-ink"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <form method="get" className="flex flex-1 flex-wrap gap-2">
            <input type="hidden" name="tab" value={tab} />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search titles"
              aria-label="Search documents"
              className="min-w-0 flex-1 rounded-lg border border-mira-line px-3 py-2 text-sm outline-none focus:border-mira-blue"
            />
            <select name="subject" defaultValue={subject} aria-label="Filter by subject" className="rounded-lg border border-mira-line px-3 py-2 text-sm">
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-mira-page px-3 py-2 text-sm hover:bg-mira-blue-soft">
              Filter
            </button>
          </form>
        </div>

        {tab === "shared" && (
          <p className="mb-3 rounded-lg bg-mira-blue-soft px-3 py-2 text-sm text-mira-blue-dark">
            Nurse Mira learns from everything here, so the AI Tutor can use it to answer your questions. Original files can be
            downloaded only when the administrator allows it.
          </p>
        )}

        {error ? (
          <p className="text-sm text-mira-danger">Couldn&apos;t load documents. Please refresh the page.</p>
        ) : (
          <DocumentList
            docs={data ?? []}
            mode={tab}
            subjects={subjects}
            topics={topics}
            currentUserId={profile.id}
            emptyTitle={q || subject ? "No documents match" : tab === "mine" ? "You haven't uploaded anything yet" : "The shared library is empty"}
            emptyText={
              q || subject
                ? "Try a different word or subject."
                : tab === "mine"
                  ? "Click Upload document to add a reviewer for everyone, or a private file just for you."
                  : "When students upload shared reviewers, they appear here."
            }
          />
        )}
      </Card>
    </>
  );
}

export default function Page(props: PageProps<"/library">) {
  return (
    <Suspense fallback={<PageLoading label="Loading your library…" />}>
      <Library {...props} />
    </Suspense>
  );
}
