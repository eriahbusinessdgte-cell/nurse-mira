import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { requireStudent } from "@/lib/supabase/server";
import { QUESTION_COLUMNS, type RevalidaQuestion } from "@/lib/revalida";
import { Practice } from "../practice";

export const metadata = { title: "Review revalida questions · Nurse Mira" };

// Bookmarked or hard questions from every session, as one review deck.
async function Review({ searchParams }: PageProps<"/revalida/review">) {
  const { supabase } = await requireStudent();
  const filter = (await searchParams).filter === "difficult" ? "difficult" : "bookmarked";
  let query = supabase.from("revalida_questions").select(QUESTION_COLUMNS).order("created_at", { ascending: false }).limit(300);
  query = filter === "bookmarked" ? query.eq("bookmarked", true) : query.in("self_assess", ["didnt", "partial"]);
  const { data } = await query;
  return <Practice reviewTitle={filter === "bookmarked" ? "Bookmarked questions" : "Questions I found hard"} initialQuestions={(data ?? []) as RevalidaQuestion[]} />;
}

export default function Page(props: PageProps<"/revalida/review">) {
  return (
    <Suspense fallback={<PageLoading label="Gathering your questions…" />}>
      <Review {...props} />
    </Suspense>
  );
}
