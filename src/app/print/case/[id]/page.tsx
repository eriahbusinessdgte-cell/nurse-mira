import { Suspense } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Section } from "@/lib/case/facts";
import { normalizePlan, planTitle, planToMarkdown, type Plan } from "@/lib/ncp/plan";
import { requireStudent } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata = { title: "Print case study · Nurse Mira" };

async function PrintCase({ params }: PageProps<"/print/case/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStudent();
  const { data: cs } = await supabase.from("case_studies").select("title, subject_id, sections").eq("id", id).maybeSingle();
  if (!cs) notFound();
  const { data: subject } = cs.subject_id ? await supabase.from("subjects").select("code, title").eq("id", cs.subject_id).maybeSingle() : { data: null };
  const sections = (cs.sections ?? []) as Section[];
  const { data: planRows } = await supabase.from("care_plans").select("id, plan").eq("case_study_id", id).order("position");
  const plans = ((planRows ?? []) as { id: string; plan: Partial<Plan> }[]).map((p) => ({ id: p.id, plan: normalizePlan(p.plan) }));
  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-10 text-[13px] leading-relaxed text-black print:p-0">
      <PrintButton />
      <h1 className="text-2xl font-bold">{cs.title}</h1>
      <p className="mb-6 text-gray-600">{subject ? `${subject.title} (${subject.code}) · ` : ""}Nursing case study</p>
      {sections.map((s, i) => (
        <section key={s.id} className="mb-6 break-inside-avoid-page">
          <h2 className="mb-2 border-b border-gray-300 text-lg font-semibold">
            {i + 1}. {s.title}
          </h2>
          <div className="prose-mira">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {(s.content || "_(not written yet)_").replace(/\s*\[S\d{1,2}\]/g, "").replace(/\[MISSING([^\]]*)\]/gi, "**[MISSING$1]**")}
            </ReactMarkdown>
          </div>
        </section>
      ))}
      {plans.length > 0 && (
        <section className="break-before-page">
          <h2 className="mb-4 text-xl font-bold">Appendix: Nursing Care Plans</h2>
          {plans.map((p, i) => (
            <div key={p.id} className="mb-8">
              <h3 className="mb-2 border-b border-gray-300 text-base font-semibold">
                NCP {i + 1}: {planTitle(p.plan)}
              </h3>
              <div className="prose-mira">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{planToMarkdown(p.plan)}</ReactMarkdown>
              </div>
            </div>
          ))}
        </section>
      )}
      <p className="mt-8 text-xs text-gray-500">Prepared with Nurse Mira for learning. Reviewed by the student; not a substitute for clinical instructor supervision.</p>
    </main>
  );
}

export default function Page(props: PageProps<"/print/case/[id]">) {
  return (
    <Suspense fallback={<p className="p-8">Preparing…</p>}>
      <PrintCase {...props} />
    </Suspense>
  );
}
