import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { requireStudent } from "@/lib/supabase/server";
import { CheckHome, type PastCheck } from "./check-home";

export const metadata = { title: "Case Study Checker · Nurse Mira" };

async function Home({ searchParams }: PageProps<"/case-studies/check">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const [
    { data: cases },
    { data: checks },
    { data: limitRow },
    { data: usage },
  ] = await Promise.all([
    supabase
      .from("case_studies")
      .select("id, title")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("case_checks")
      .select("id, title, status, format, created_at, saved_case_study_id")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("student_daily_limit"),
    supabase
      .from("ai_usage")
      .select("answers")
      .eq("student_id", profile.id)
      .eq("day", manilaDay())
      .maybeSingle(),
  ]);
  return (
    <CheckHome
      cases={(cases ?? []) as { id: string; title: string }[]}
      checks={(checks ?? []) as PastCheck[]}
      remaining={Math.max(
        0,
        (Number(limitRow ?? 10) || 10) - (usage?.answers ?? 0),
      )}
      preselect={typeof params.case === "string" ? params.case : null}
    />
  );
}

export default function Page(props: PageProps<"/case-studies/check">) {
  return (
    <Suspense
      fallback={<PageLoading label="Opening the Case Study Checker…" />}
    >
      <Home {...props} />
    </Suspense>
  );
}
