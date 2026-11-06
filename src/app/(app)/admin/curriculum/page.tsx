import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Badge, Card, PageHeader } from "@/components/ui";
import { groupSubjects, type Subject } from "@/lib/curriculum";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Curriculum · Nurse Mira" };

// Phase 3 (first part): view the curriculum and how many students take each subject.
// Editing subjects and managing topics is added next.
async function Curriculum() {
  const { supabase } = await requireProfile("admin");
  const [{ data: subjects }, { data: links }] = await Promise.all([
    supabase.from("subjects").select("id, code, title, year_level, semester, is_active").order("sort_order").returns<Subject[]>(),
    supabase.from("student_subjects").select("subject_id"),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.subject_id, (counts.get(l.subject_id) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Curriculum"
        description={`${subjects?.length ?? 0} subjects across 4 year levels and 8 semesters. Editing subjects and topics is coming in the next update.`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {groupSubjects(subjects ?? []).map((g) => (
          <Card key={`${g.year}-${g.semester}`}>
            <h2 className="mb-3 font-semibold">
              {YEAR_LABEL[g.year]} · {SEM_LABEL[g.semester]}
            </h2>
            <ul className="space-y-2">
              {g.subjects.map((s) => (
                <li key={s.id} id={s.id} className="flex items-start justify-between gap-3 rounded-lg bg-mira-page px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{s.code}</span> — {s.title}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="blue">{counts.get(s.id) ?? 0} student(s)</Badge>
                    {s.is_active === false && <Badge tone="gray">Retired</Badge>}
                  </span>
                </li>
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
