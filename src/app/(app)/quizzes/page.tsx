import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { requireStudent } from "@/lib/supabase/server";
import { QuizHome, type AttemptRow, type QuizRow } from "./quiz-home";

export const metadata = { title: "Quizzes & Exams · Nurse Mira" };

async function Quizzes() {
  const { supabase, profile } = await requireStudent();
  const [{ data: quizzes }, { data: attempts }, { data: subjects }, { data: mine }, { data: sheets }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("quizzes").select("id, title, subject_id, focus, kind, time_limit_minutes, origin, created_at, questions").order("created_at", { ascending: false }).limit(100),
    supabase.from("quiz_attempts").select("id, quiz_id, score, total, by_topic, finished_at").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(300),
    supabase.from("subjects").select("id, code, title, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
    supabase.from("review_sheets").select("subject_id, focus"),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);
  const limit = Number(limitRow ?? 10) || 10;
  return (
    <QuizHome
      quizzes={((quizzes ?? []) as (QuizRow & { questions: unknown[] })[]).map(({ questions, ...q }) => ({ ...q, count: questions.length }))}
      attempts={(attempts ?? []) as AttemptRow[]}
      subjects={(subjects ?? []) as { id: string; code: string; title: string; sort_order: number }[]}
      mySubjectIds={(mine ?? []).map((r) => r.subject_id as string)}
      sheets={(sheets ?? []) as { subject_id: string; focus: string }[]}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Opening your quizzes…" />}>
      <Quizzes />
    </Suspense>
  );
}
