import { Fragment, Suspense } from "react";
import { normalizeStudy, studyRows, studyTitle } from "@/lib/drug/study";
import { requireStudent } from "@/lib/supabase/server";
import { PrintButton } from "../case/[id]/print-button";

export const metadata = { title: "Print drug studies · Nurse Mira" };

function Cell({ text }: { text: string }) {
  return (
    <>
      {text.split("<br>").map((line, i) => {
        const bold = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
        return (
          <Fragment key={i}>
            {i > 0 && <br />}
            {bold ? (
              <>
                <b>{bold[1]}</b> {bold[2]}
              </>
            ) : (
              line
            )}
          </Fragment>
        );
      })}
    </>
  );
}

async function PrintStudies({ searchParams }: PageProps<"/print/drug">) {
  const { supabase } = await requireStudent();
  const params = await searchParams;
  const group = typeof params.group === "string" ? params.group : "all";
  let query = supabase.from("drug_studies").select("id, case_study_id, position, study").order("case_study_id").order("position");
  if (group === "none") query = query.is("case_study_id", null);
  else if (group !== "all") query = query.eq("case_study_id", group);
  const { data } = await query;
  const studies = (data ?? []).map((s) => ({ id: s.id as string, study: normalizeStudy(s.study) }));
  const { data: cs } = group !== "all" && group !== "none" ? await supabase.from("case_studies").select("title").eq("id", group).maybeSingle() : { data: null };
  return (
    <main className="mx-auto max-w-4xl bg-white px-8 py-10 text-[12.5px] leading-snug text-black print:p-0">
      <PrintButton />
      <h1 className="text-2xl font-bold">Drug Study</h1>
      <p className="mb-6 text-gray-600">{cs ? `Case study: ${cs.title}` : "Prepared with Nurse Mira"}</p>
      {studies.length === 0 && <p>No drug studies yet.</p>}
      {studies.map((s, i) => (
        <section key={s.id} className="mb-8 break-before-page first:break-before-auto">
          <h2 className="mb-2 text-lg font-semibold">
            {i + 1}. {studyTitle(s.study)}
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              {studyRows(s.study).map(([k, v]) => (
                <tr key={k} className="align-top">
                  <th className="w-[28%] border border-gray-400 bg-gray-50 px-2 py-1.5 text-left font-semibold">{k}</th>
                  <td className="border border-gray-400 px-2 py-1.5">
                    <Cell text={v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="mt-8 text-xs text-gray-500">A learning aid prepared by the student with Nurse Mira. Verify every drug and dose against a current drug reference, the physician&apos;s order and the clinical instructor.</p>
    </main>
  );
}

export default function Page(props: PageProps<"/print/drug">) {
  return (
    <Suspense fallback={<p className="p-8">Preparing…</p>}>
      <PrintStudies {...props} />
    </Suspense>
  );
}
