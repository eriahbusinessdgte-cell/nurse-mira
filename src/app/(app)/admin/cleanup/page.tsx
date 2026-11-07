import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/supabase/server";
import { CleanupTools, type Preview } from "./cleanup-tools";

export const metadata = { title: "Clean up · Nurse Mira" };

async function Cleanup() {
  const { supabase } = await requireProfile("admin");
  const { data } = await supabase.rpc("admin_cleanup_preview");
  return <CleanupTools preview={data as Preview} />;
}

export default function CleanupPage() {
  return (
    <>
      <PageHeader
        title="Clean up"
        description="Free up space, for example at the end of each semester. Check what each option removes, then confirm. Chats a student marked “Keep” are never touched."
      />
      <Suspense fallback={<PageLoading />}>
        <Cleanup />
      </Suspense>
    </>
  );
}
