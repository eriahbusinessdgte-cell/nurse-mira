import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import { FullReviewers } from "@/components/full-reviewers";
import { loadFullReviewers } from "@/lib/full-reviewers";
import { requireStudent } from "@/lib/supabase/server";

export const metadata = { title: "Full reviewers · Nurse Mira" };

async function Full({ searchParams }: PageProps<"/review/full">) {
  const { supabase, profile } = await requireStudent();
  const params = await searchParams;
  const openId = typeof params.full === "string" ? params.full : null;
  const docId = typeof params.doc === "string" ? params.doc : null;
  const { docs, reviewers, initial } = await loadFullReviewers(supabase, openId);
  return <FullReviewers key={initial?.id ?? "list"} docs={docs} reviewers={reviewers} me={profile.id} isAdmin={false} initial={initial} initialDocId={docId} basePath="/review/full" />;
}

export default function Page(props: PageProps<"/review/full">) {
  return (
    <>
      <PageHeader title="Full reviewers" description="A complete reviewer for a whole library document — made part by part, about 10 pages at a time." />
      <Suspense fallback={<PageLoading label="Opening full reviewers…" />}>
        <Full {...props} />
      </Suspense>
    </>
  );
}
