import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/supabase/server";
import { BackupTools } from "./backup-tools";

export const metadata = { title: "Backups · Nurse Mira" };

async function Backups() {
  const { supabase } = await requireProfile("admin");
  const { data } = await supabase.from("app_settings").select("value").eq("key", "last_backup_at").maybeSingle();
  const last = typeof data?.value === "string" ? data.value : null;
  return <BackupTools lastBackupAt={last} />;
}

export default function BackupPage() {
  return (
    <>
      <PageHeader
        title="Backups"
        description="The free plan doesn't keep backups you can download, so make your own here about once a week. The file is locked with a password only you know."
      />
      <Suspense fallback={<PageLoading />}>
        <Backups />
      </Suspense>
    </>
  );
}
