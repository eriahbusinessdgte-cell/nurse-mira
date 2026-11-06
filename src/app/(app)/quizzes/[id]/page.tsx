import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import type { Question } from "@/lib/quiz/grade";
import { requireStudent } from "@/lib/supabase/server";
import { QuizTaker } from "./quiz-taker";

export const metadata = { title: "Quiz · Nurse Mira" };

async function Quiz({ params }: PageProps<"/quizzes/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStudent();
  const { data: quiz } = await supabase.from("quizzes").select("id, title, kind, time_limit_minutes, questions, origin, sources").eq("id", id).maybeSingle();
  if (!quiz) notFound();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, total, finished_at, timed_out")
    .eq("quiz_id", id)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(20);
  return (
    <QuizTaker
      quiz={{ ...quiz, questions: quiz.questions as Question[], sources: (quiz.sources ?? []) as { n: number; title: string; page: number | null }[] }}
      attempts={(attempts ?? []) as { id: string; score: number; total: number; finished_at: string; timed_out: boolean }[]}
    />
  );
}

export default function Page(props: PageProps<"/quizzes/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Opening the quiz…" />}>
      <Quiz {...props} />
    </Suspense>
  );
}
