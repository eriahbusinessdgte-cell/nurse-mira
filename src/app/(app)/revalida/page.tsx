import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { requireStudent } from "@/lib/supabase/server";
import { RevalidaHome, type CaseOption, type HistoryItem } from "./revalida-home";

export const metadata = { title: "Oral Revalida · Nurse Mira" };

async function Home({ searchParams }: PageProps<"/revalida">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const [{ data: cases }, { data: sessions }, { data: questions }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("case_studies").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("revalida_sessions").select("id, case_id, case_title, requested, difficulty, status, created_at, completed_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("revalida_questions").select("session_id, revealed, skipped, bookmarked, self_assess").limit(5000),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);
  const bySession = new Map<string, { n: number; revealed: number; bookmarked: number; knew: number; partial: number; didnt: number }>();
  for (const q of questions ?? []) {
    const c = bySession.get(q.session_id) ?? { n: 0, revealed: 0, bookmarked: 0, knew: 0, partial: 0, didnt: 0 };
    c.n++;
    if (q.revealed) c.revealed++;
    if (q.bookmarked) c.bookmarked++;
    if (q.self_assess === "knew") c.knew++;
    if (q.self_assess === "partial") c.partial++;
    if (q.self_assess === "didnt") c.didnt++;
    bySession.set(q.session_id, c);
  }
  const history: HistoryItem[] = (sessions ?? []).map((s) => ({ ...s, counts: bySession.get(s.id) ?? { n: 0, revealed: 0, bookmarked: 0, knew: 0, partial: 0, didnt: 0 } }));
  const limit = Number(limitRow ?? 10) || 10;
  const preselect = typeof params.case === "string" ? params.case : null;
  return (
    <RevalidaHome
      cases={(cases ?? []) as CaseOption[]}
      history={history}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
      preselect={preselect}
      totals={{
        bookmarked: (questions ?? []).filter((q) => q.bookmarked).length,
        difficult: (questions ?? []).filter((q) => q.self_assess === "didnt" || q.self_assess === "partial").length,
      }}
    />
  );
}

export default function Page(props: PageProps<"/revalida">) {
  return (
    <Suspense fallback={<PageLoading label="Opening Oral Revalida…" />}>
      <Home {...props} />
    </Suspense>
  );
}
