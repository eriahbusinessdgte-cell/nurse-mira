import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizePlan, planTitle, planToMarkdown, type Plan } from "@/lib/ncp/plan";
import { requireStudent } from "@/lib/supabase/server";
import { PrintButton } from "../case/[id]/print-button";

export const metadata = { title: "Print care plans · Nurse Mira" };

async function PrintPlans({ searchParams }: PageProps<"/print/ncp">) {
  const { supabase } = await requireStudent();
  const params = await searchParams;
  const group = typeof params.group === "string" ? params.group : "all";
  let query = supabase.from("care_plans").select("id, case_study_id, position, plan").order("case_study_id").order("position");
  if (group === "none") query = query.is("case_study_id", null);
  else if (group !== "all") query = query.eq("case_study_id", group);
  const { data } = await query;
  const plans = ((data ?? []) as { id: string; plan: Partial<Plan> }[]).map((p) => ({ id: p.id, plan: normalizePlan(p.plan) }));
  const { data: cs } = group !== "all" && group !== "none" ? await supabase.from("case_studies").select("title").eq("id", group).maybeSingle() : { data: null };
  return (
    <main className="mx-auto max-w-4xl bg-white px-8 py-10 text-[13px] leading-relaxed text-black print:p-0">
      <PrintButton />
      <h1 className="text-2xl font-bold">Nursing Care Plans</h1>
      <p className="mb-6 text-gray-600">{cs ? `Case study: ${cs.title}` : "Prepared with Nurse Mira"}</p>
      {plans.length === 0 && <p>No care plans yet.</p>}
      {plans.map((p, i) => (
        <section key={p.id} className="mb-8 break-before-page first:break-before-auto">
          <h2 className="mb-2 border-b border-gray-300 text-lg font-semibold">
            NCP {i + 1}: {planTitle(p.plan)}
          </h2>
          <div className="prose-mira">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{planToMarkdown(p.plan)}</ReactMarkdown>
          </div>
        </section>
      ))}
      <p className="mt-8 text-xs text-gray-500">A learning aid prepared by the student with Nurse Mira; not a substitute for clinical instructor supervision or clinical judgment.</p>
    </main>
  );
}

export default function Page(props: PageProps<"/print/ncp">) {
  return (
    <Suspense fallback={<p className="p-8">Preparing…</p>}>
      <PrintPlans {...props} />
    </Suspense>
  );
}
