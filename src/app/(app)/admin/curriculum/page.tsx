import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Card, PageHeader } from "@/components/ui";
import { groupSubjects } from "@/lib/curriculum";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";
import { AddSubject, SubjectCard, type SubjectRow } from "./curriculum-editor";

export const metadata = { title: "Curriculum · Nurse Mira" };

async function Curriculum() {
  const { supabase } = await requireProfile("admin");
  const [{ data: subjects }, { data: topics }, { data: links }] = await Promise.all([
    supabase.from("subjects").select("id, code, title, description, year_level, semester, is_active").order("sort_order"),
    supabase.from("topics").select("id, subject_id, name, is_active").order("sort_order"),
    supabase.from("student_subjects").select("subject_id"),
  ]);

  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.subject_id, (counts.get(l.subject_id) ?? 0) + 1);

  const rows: SubjectRow[] = (subjects ?? []).map((s) => ({
    ...s,
    topics: (topics ?? []).filter((t) => t.subject_id === s.id),
    students: counts.get(s.id) ?? 0,
  }));
  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <>
      <PageHeader
        title="Curriculum"
        description={`${activeCount} active subjects across 4 year levels and 8 semesters. Click a subject to edit it or manage its topics.`}
        action={<AddSubject />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {groupSubjects(rows).map((g) => (
          <Card key={`${g.year}-${g.semester}`}>
            <h2 className="mb-3 font-semibold">
              {YEAR_LABEL[g.year]} · {SEM_LABEL[g.semester]}
            </h2>
            <ul className="space-y-2">
              {g.subjects.map((s) => (
                <SubjectCard key={s.id} subject={s} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading the curriculum…" />}>
      <Curriculum />
    </Suspense>
  );
}
