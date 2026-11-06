import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import type { Facts, Section } from "@/lib/case/facts";
import { requireStudent } from "@/lib/supabase/server";
import { CaseEditor } from "./case-editor";

export const metadata = { title: "Case Study · Nurse Mira" };

async function Editor({ params }: PageProps<"/case-studies/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireStudent();
  const [{ data: cs }, { data: subjects }, { data: mine }] = await Promise.all([
    supabase.from("case_studies").select("id, title, subject_id, facts, sections, deidentified_confirmed, updated_at").eq("id", id).maybeSingle(),
    supabase.from("subjects").select("id, code, title, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
  ]);
  if (!cs) notFound();
  return (
    <CaseEditor
      initial={{
        id: cs.id,
        title: cs.title,
        subject_id: cs.subject_id,
        facts: (cs.facts ?? {}) as Facts,
        sections: (cs.sections ?? []) as Section[],
        deidentified_confirmed: cs.deidentified_confirmed,
      }}
      subjects={(subjects ?? []) as { id: string; code: string; title: string; sort_order: number }[]}
      mySubjectIds={(mine ?? []).map((r) => r.subject_id as string)}
    />
  );
}

export default function Page(props: PageProps<"/case-studies/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Opening your case study…" />}>
      <Editor {...props} />
    </Suspense>
  );
}
