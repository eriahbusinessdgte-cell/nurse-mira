import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import type { Item } from "@/lib/planner/plan";
import { requireStudent } from "@/lib/supabase/server";
import { Planner } from "./planner";

export const metadata = { title: "My Planner · Nurse Mira" };

async function PlannerPage() {
  const { supabase, profile } = await requireStudent();
  const [{ data: items }, { data: subjects }, { data: mine }, { data: cases }] = await Promise.all([
    supabase.from("planner_items").select("id, title, kind, subject_id, case_study_id, due_date, due_time, status, priority, notes, completed_at").order("due_date", { nullsFirst: false }).limit(1000),
    supabase.from("subjects").select("id, code, title, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
    supabase.from("case_studies").select("id, title").order("updated_at", { ascending: false }).limit(100),
  ]);
  const mySubjectIds = (mine ?? []).map((r) => r.subject_id as string);
  const all = (subjects ?? []) as { id: string; code: string; title: string; sort_order: number }[];
  return (
    <Planner
      items={(items ?? []) as Item[]}
      subjects={[...all].sort((a, b) => Number(mySubjectIds.includes(b.id)) - Number(mySubjectIds.includes(a.id)) || a.sort_order - b.sort_order)}
      mySubjectIds={mySubjectIds}
      cases={(cases ?? []) as { id: string; title: string }[]}
      today={manilaDay()}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Opening your planner…" />}>
      <PlannerPage />
    </Suspense>
  );
}
