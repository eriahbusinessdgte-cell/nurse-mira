import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageLoading } from "@/components/page-loading";
import { Badge, Card } from "@/components/ui";
import type { Subject } from "@/lib/curriculum";
import { requireProfile } from "@/lib/supabase/server";
import { AccessPanel, DetailsForm, SubjectsEditor } from "./student-forms";

export const metadata = { title: "Student · Nurse Mira" };

async function StudentDetail({ params }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const { supabase } = await requireProfile("admin");

  const [{ data: student }, { data: subjects }, { data: chosen }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, preferred_name, year_level, current_semester, is_active, onboarding_completed, created_at, role")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("subjects").select("id, code, title, year_level, semester").eq("is_active", true).order("sort_order").returns<Subject[]>(),
    supabase.from("student_subjects").select("subject_id").eq("student_id", id),
  ]);
  if (!student || student.role !== "student") notFound();

  return (
    <>
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-1 text-sm text-mira-muted hover:text-mira-ink">
        <ChevronLeft size={16} aria-hidden /> All students
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{student.full_name || student.email}</h1>
        {student.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Turned off</Badge>}
        {!student.onboarding_completed && student.is_active && <Badge tone="yellow">Not set up yet</Badge>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-semibold">Details</h2>
            <DetailsForm student={student} />
          </Card>
          <Card>
            <h2 className="mb-1 font-semibold">Subjects</h2>
            <p className="mb-4 text-sm text-mira-muted">Subjects can come from any year — irregular loads are fine.</p>
            <SubjectsEditor
              studentId={student.id}
              subjects={subjects ?? []}
              initial={(chosen ?? []).map((r) => r.subject_id as string)}
              highlight={{ year: student.year_level, semester: student.current_semester }}
            />
          </Card>
        </div>
        <AccessPanel student={student} />
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/admin/students/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Loading student…" />}>
      <StudentDetail {...props} />
    </Suspense>
  );
}
