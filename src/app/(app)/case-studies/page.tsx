import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { requireStudent } from "@/lib/supabase/server";
import { CaseList } from "./case-list";

export const metadata = { title: "Case Studies · Nurse Mira" };

async function Cases() {
  const { supabase } = await requireStudent();
  const [{ data: cases }, { data: subjects }] = await Promise.all([
    supabase.from("case_studies").select("id, title, subject_id, sections, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("subjects").select("id, code, title"),
  ]);
  return (
    <CaseList
      cases={(cases ?? []).map((c) => {
        const sections = (c.sections ?? []) as { content: string }[];
        return {
          id: c.id as string,
          title: c.title as string,
          subject_id: c.subject_id as string | null,
          updated_at: c.updated_at as string,
          sections: sections.length,
          filled: sections.filter((s) => s.content?.trim()).length,
          missing: sections.reduce((n, s) => n + (s.content?.match(/\[MISSING[^\]]*\]/gi)?.length ?? 0), 0),
        };
      })}
      subjects={(subjects ?? []) as { id: string; code: string; title: string }[]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Opening your case studies…" />}>
      <Cases />
    </Suspense>
  );
}
