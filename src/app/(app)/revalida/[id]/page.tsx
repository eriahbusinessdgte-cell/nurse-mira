import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import { requireStudent } from "@/lib/supabase/server";
import { QUESTION_COLUMNS, SESSION_COLUMNS, type RevalidaQuestion, type RevalidaSession } from "@/lib/revalida";
import { Practice } from "../practice";

export const metadata = { title: "Oral Revalida practice · Nurse Mira" };

async function Session({ params }: PageProps<"/revalida/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStudent();
  // Database rules only return the student's own session and questions.
  const [{ data: session }, { data: questions }] = await Promise.all([
    supabase.from("revalida_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("revalida_questions").select(QUESTION_COLUMNS).eq("session_id", id).order("position"),
  ]);
  if (!session) notFound();
  return <Practice session={session as RevalidaSession} initialQuestions={(questions ?? []) as RevalidaQuestion[]} />;
}

export default function Page(props: PageProps<"/revalida/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Opening your practice session…" />}>
      <Session {...props} />
    </Suspense>
  );
}
