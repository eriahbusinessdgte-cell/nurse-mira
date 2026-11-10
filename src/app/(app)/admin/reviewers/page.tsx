import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import { FullReviewers } from "@/components/full-reviewers";
import { loadFullReviewers } from "@/lib/full-reviewers";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Full reviewers · Nurse Mira" };

async function Full({ searchParams }: PageProps<"/admin/reviewers">) {
  const { supabase, profile } = await requireProfile("admin");
  const params = await searchParams;
  const openId = typeof params.full === "string" ? params.full : null;
  const docId = typeof params.doc === "string" ? params.doc : null;
  const { docs, reviewers, initial } = await loadFullReviewers(supabase, openId);
  return <FullReviewers key={initial?.id ?? "list"} docs={docs} reviewers={reviewers} me={profile.id} isAdmin initial={initial} initialDocId={docId} basePath="/admin/reviewers" />;
}

export default function Page(props: PageProps<"/admin/reviewers">) {
  return (
    <>
      <PageHeader
        title="Full reviewers"
        description="Make a complete reviewer for a whole library document and share it with every student. Building uses the AI, but students open shared reviewers for free."
      />
      <Suspense fallback={<PageLoading label="Opening full reviewers…" />}>
        <Full {...props} />
      </Suspense>
    </>
  );
}
