import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { requireStudent } from "@/lib/supabase/server";
import { ReviewCenter, type SheetRow, type SubjectOption, type TopicOption } from "./review-center";

export const metadata = { title: "Review Center · Nurse Mira" };

async function Review({ searchParams }: PageProps<"/review">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const requested = typeof params.sheet === "string" ? params.sheet : null;

  const [{ data: subjects }, { data: topics }, { data: mine }, { data: recent }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("subjects").select("id, code, title, year_level, semester, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("topics").select("id, subject_id, name").eq("is_active", true).order("sort_order"),
    supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
    supabase.from("review_sheets").select("id, subject_id, focus, from_library, created_at, views").order("created_at", { ascending: false }).limit(60),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);

  let opened: SheetRow | null = null;
  if (requested) {
    const { data } = await supabase.from("review_sheets").select("*").eq("id", requested).maybeSingle();
    opened = (data as SheetRow | null) ?? null;
  }
  const limit = Number(limitRow ?? 10) || 10;

  return (
    <ReviewCenter
      key={opened?.id ?? "none"}
      subjects={(subjects ?? []) as SubjectOption[]}
      topics={(topics ?? []) as TopicOption[]}
      mySubjectIds={(mine ?? []).map((r) => r.subject_id as string)}
      recent={(recent ?? []) as Pick<SheetRow, "id" | "subject_id" | "focus" | "from_library" | "created_at" | "views">[]}
      initialSheet={opened}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
      defaultYear={profile.year_level ?? null}
      defaultSemester={profile.current_semester ?? null}
    />
  );
}

export default function Page(props: PageProps<"/review">) {
  return (
    <Suspense fallback={<PageLoading label="Opening the Review Center…" />}>
      <Review {...props} />
    </Suspense>
  );
}
