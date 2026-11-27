import { Suspense } from "react";
import { notFound } from "next/navigation";
import { COLUMNS, DOC_TITLE, normalizePlan } from "@/lib/fncp/plan";
import { requireStudent } from "@/lib/supabase/server";
import { PrintButton } from "../../case/[id]/print-button";
import { FncpTable } from "./fncp-table";

export const metadata = { title: "Print family nursing care plan · Nurse Mira" };

async function PrintPlan({ params }: PageProps<"/print/fncp/[id]">) {
  const { supabase } = await requireStudent();
  const { id } = await params;
  const { data } = await supabase.from("family_care_plans").select("title, input, plan").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <FncpTable title={DOC_TITLE} situation={data.input} plan={normalizePlan(data.plan)} columns={COLUMNS.map(([k, l]) => [k, l])} printButton={<PrintButton />} />;
}

export default function Page(props: PageProps<"/print/fncp/[id]">) {
  return (
    <Suspense fallback={<p className="p-8">Preparing…</p>}>
      <PrintPlan {...props} />
    </Suspense>
  );
}
