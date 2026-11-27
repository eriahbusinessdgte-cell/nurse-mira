import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import { requireStudent } from "@/lib/supabase/server";
import { CheckResult, type CheckRow } from "./check-result";

export const metadata = { title: "Case study check · Nurse Mira" };

async function Result({ params }: PageProps<"/case-studies/check/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStudent();
  const { data } = await supabase
    .from("case_checks")
    .select(
      "id, title, format, status, sections, parts, overview, changes, saved_case_study_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return <CheckResult initial={data as CheckRow} />;
}

export default function Page(props: PageProps<"/case-studies/check/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Opening your check…" />}>
      <Result {...props} />
    </Suspense>
  );
}
