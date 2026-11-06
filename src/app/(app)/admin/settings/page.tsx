import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import { readSettings } from "@/lib/settings";
import { requireProfile } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings · Nurse Mira" };

async function Settings() {
  const { supabase } = await requireProfile("admin");
  const [{ data: rows }, { count }] = await Promise.all([
    supabase.from("app_settings").select("key, value"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("is_active", true),
  ]);
  return <SettingsForm initial={readSettings(rows)} activeStudents={count ?? 0} />;
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Change how Nurse Mira shares its free AI allowances. Changes apply right away for everyone." />
      <Suspense fallback={<PageLoading />}>
        <Settings />
      </Suspense>
    </>
  );
}
