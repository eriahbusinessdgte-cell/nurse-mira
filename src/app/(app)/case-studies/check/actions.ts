"use server";

import { revalidatePath } from "next/cache";
import { newSectionId } from "@/lib/case/facts";
import { requireStudent } from "@/lib/supabase/server";

type CheckSection = { title: string; original: string; revised: string | null };

/**
 * Save the checked case study as a NEW case study (the student's original is never overwritten).
 * `keepOriginal` lists the sections where the student chose their own wording over Nurse Mira's revision.
 */
export async function saveRevisedCaseStudy(
  checkId: string,
  keepOriginal: number[],
) {
  const { supabase, profile } = await requireStudent();
  // Database rules only return the student's own check.
  const { data: check } = await supabase
    .from("case_checks")
    .select("id, title, status, sections, case_study_id")
    .eq("id", checkId)
    .maybeSingle();
  if (!check) return { ok: false as const, error: "That check wasn't found." };
  if (check.status !== "ready")
    return { ok: false as const, error: "The check isn't finished yet." };
  const keep = new Set(keepOriginal);
  const sections = (check.sections as CheckSection[]).map((s, i) => ({
    id: newSectionId(),
    title: s.title,
    content: keep.has(i) || !s.revised ? s.original : s.revised,
  }));
  let subjectId: string | null = null;
  if (check.case_study_id) {
    const { data: cs } = await supabase
      .from("case_studies")
      .select("subject_id")
      .eq("id", check.case_study_id)
      .maybeSingle();
    subjectId = cs?.subject_id ?? null;
  }
  const { data, error } = await supabase
    .from("case_studies")
    .insert({
      student_id: profile.id,
      title: `${check.title} (checked)`.slice(0, 160),
      subject_id: subjectId,
      sections,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false as const,
      error: "The case study couldn't be saved. Please try again.",
    };
  await supabase
    .from("case_checks")
    .update({ saved_case_study_id: data.id })
    .eq("id", check.id);
  revalidatePath("/case-studies");
  return { ok: true as const, id: data.id as string };
}
