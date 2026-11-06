import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { normalizePlan, type Plan } from "@/lib/ncp/plan";
import { requireStudent } from "@/lib/supabase/server";
import { CarePlans, type PlanRow } from "./care-plans";

export const metadata = { title: "Nursing Care Plans · Nurse Mira" };

async function Plans({ searchParams }: PageProps<"/care-plans">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const caseParam = typeof params.case === "string" ? params.case : "";
  const [{ data: plans }, { data: cases }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("care_plans").select("id, case_study_id, position, plan, ai_generated, updated_at").order("position").limit(300),
    supabase.from("case_studies").select("id, title, deidentified_confirmed").order("updated_at", { ascending: false }).limit(100),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);
  const caseList = (cases ?? []) as { id: string; title: string; deidentified_confirmed: boolean }[];
  const limit = Number(limitRow ?? 10) || 10;
  return (
    <CarePlans
      key={caseParam}
      plans={((plans ?? []) as (Omit<PlanRow, "plan"> & { plan: Partial<Plan> })[]).map((p) => ({ ...p, plan: normalizePlan(p.plan) }))}
      cases={caseList}
      initialGroup={caseParam && caseList.some((c) => c.id === caseParam) ? caseParam : caseList.length ? "all" : "none"}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
    />
  );
}

export default function Page(props: PageProps<"/care-plans">) {
  return (
    <Suspense fallback={<PageLoading label="Opening your care plans…" />}>
      <Plans {...props} />
    </Suspense>
  );
}
