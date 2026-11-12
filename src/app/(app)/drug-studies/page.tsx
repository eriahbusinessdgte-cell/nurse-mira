import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { normalizeStudy } from "@/lib/drug/study";
import { requireStudent } from "@/lib/supabase/server";
import { DrugStudies, type StudyRow } from "./drug-studies";

export const metadata = { title: "Drug Studies · Nurse Mira" };

async function Studies({ searchParams }: PageProps<"/drug-studies">) {
  const { supabase, profile } = await requireStudent();
  const caseParam = (await searchParams).case;
  const [{ data: studies }, { data: cases }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("drug_studies").select("id, case_study_id, position, study, ai_generated, updated_at").order("position").limit(500),
    supabase.from("case_studies").select("id, title, deidentified_confirmed").order("updated_at", { ascending: false }).limit(100),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);
  const limit = Number(limitRow ?? 10) || 10;
  const caseList = (cases ?? []) as { id: string; title: string; deidentified_confirmed: boolean }[];
  const initialCase = typeof caseParam === "string" && caseList.some((c) => c.id === caseParam) ? caseParam : null;
  return (
    <DrugStudies
      key={initialCase ?? "all"}
      initialCase={initialCase}
      studies={((studies ?? []) as StudyRow[]).map((s) => ({ ...s, study: normalizeStudy(s.study) }))}
      cases={caseList}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
    />
  );
}

export default function Page(props: PageProps<"/drug-studies">) {
  return (
    <Suspense fallback={<PageLoading label="Opening your drug studies…" />}>
      <Studies {...props} />
    </Suspense>
  );
}
