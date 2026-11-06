import { manilaDay } from "@/lib/dates";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { requireStudent } from "@/lib/supabase/server";
import { TutorChat, type ChatMessage, type ConversationItem } from "./tutor-chat";

export const metadata = { title: "AI Tutor · Nurse Mira" };


async function Tutor({ searchParams }: PageProps<"/tutor">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const requested = typeof params.c === "string" ? params.c : null;
  const ask = typeof params.ask === "string" ? params.ask.slice(0, 500) : "";

  const [{ data: conversations }, { data: mySubjects }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("conversations").select("id, title, mode, subject_id, last_message_at, summary, next_step").order("last_message_at", { ascending: false }).limit(50),
    supabase.from("student_subjects").select("subjects(id, code, title, sort_order)").eq("student_id", profile.id),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);

  const list = (conversations ?? []) as ConversationItem[];
  const active = requested ? list.find((c) => c.id === requested) ?? null : null;
  let messages: ChatMessage[] = [];
  if (active) {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, sources, mode, safety_mode, created_at")
      .eq("conversation_id", active.id)
      .order("id");
    messages = (data ?? []) as ChatMessage[];
  }

  const subjects = ((mySubjects ?? []) as unknown as { subjects: { id: string; code: string; title: string; sort_order: number } }[])
    .map((r) => r.subjects)
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);
  const limit = Number(limitRow ?? 10) || 10;

  return (
    <TutorChat
      key={active?.id ?? "new"}
      conversations={list}
      active={active}
      initialMessages={messages}
      subjects={subjects}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
      limit={limit}
      studentName={(profile.preferred_name || profile.full_name).split(" ")[0]}
      initialQuestion={ask}
    />
  );
}

export default function Page(props: PageProps<"/tutor">) {
  return (
    <Suspense fallback={<PageLoading label="Opening the AI Tutor…" />}>
      <Tutor {...props} />
    </Suspense>
  );
}
