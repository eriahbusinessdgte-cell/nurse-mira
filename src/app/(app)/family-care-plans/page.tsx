import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { manilaDay } from "@/lib/dates";
import { normalizePlan } from "@/lib/fncp/plan";
import { firstName } from "@/lib/greeting";
import { requireStudent } from "@/lib/supabase/server";
import { FncpMaker, type SavedPlan } from "./fncp-maker";

export const metadata = { title: "Family Care Plans · Nurse Mira" };

async function Plans({ searchParams }: PageProps<"/family-care-plans">) {
  const { supabase, profile } = await requireStudent();
  const open = (await searchParams).plan;
  const [{ data }, { data: limitRow }, { data: usage }] = await Promise.all([
    supabase.from("family_care_plans").select("id, title, input, plan, ai_generated, updated_at").order("updated_at", { ascending: false }).limit(200),
    supabase.rpc("student_daily_limit"),
    supabase.from("ai_usage").select("answers").eq("student_id", profile.id).eq("day", manilaDay()).maybeSingle(),
  ]);
  const limit = Number(limitRow ?? 10) || 10;
  return (
    <FncpMaker
      plans={((data ?? []) as SavedPlan[]).map((p) => ({ ...p, plan: normalizePlan(p.plan) }))}
      studentName={firstName(profile.full_name, profile.preferred_name)}
      initialOpen={typeof open === "string" ? open : null}
      remaining={Math.max(0, limit - (usage?.answers ?? 0))}
    />
  );
}

export default function Page(props: PageProps<"/family-care-plans">) {
  return (
    <Suspense fallback={<PageLoading label="Opening your family care plans…" />}>
      <Plans {...props} />
    </Suspense>
  );
}
