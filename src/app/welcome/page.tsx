import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import type { Subject } from "@/lib/curriculum";
import { requireProfile } from "@/lib/supabase/server";
import { Onboarding } from "./onboarding";

export const metadata = { title: "Welcome · Nurse Mira" };

async function Welcome() {
  const { supabase, profile } = await requireProfile();
  if (profile.role === "admin") redirect("/admin");
  if (profile.onboarding_completed) redirect("/dashboard");

  const [{ data: subjects }, { data: chosen }] = await Promise.all([
    supabase.from("subjects").select("id, code, title, year_level, semester").eq("is_active", true).order("sort_order").returns<Subject[]>(),
    supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
  ]);

  return (
    <Onboarding
      profile={{
        full_name: profile.full_name,
        preferred_name: profile.preferred_name ?? "",
        year_level: profile.year_level,
        current_semester: profile.current_semester,
      }}
      subjects={subjects ?? []}
      chosen={(chosen ?? []).map((r) => r.subject_id as string)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Getting things ready…" />}>
      <Welcome />
    </Suspense>
  );
}
