import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import type { Subject } from "@/lib/curriculum";
import { requireStudent } from "@/lib/supabase/server";
import { MySubjects } from "./my-subjects";

export const metadata = { title: "My Subjects · Nurse Mira" };

async function SubjectsPage() {
  const { supabase, profile } = await requireStudent();
  const [{ data: subjects }, { data: chosen }] = await Promise.all([
    supabase.from("subjects").select("id, code, title, year_level, semester").eq("is_active", true).order("sort_order").returns<Subject[]>(),
    supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
  ]);

  return (
    <>
      <PageHeader
        title="My Subjects"
        description="Tick the subjects you're taking now. You can choose subjects from any year — irregular loads are fine."
      />
      <MySubjects
        subjects={subjects ?? []}
        initial={(chosen ?? []).map((r) => r.subject_id as string)}
        highlight={{ year: profile.year_level, semester: profile.current_semester }}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading your subjects…" />}>
      <SubjectsPage />
    </Suspense>
  );
}
