"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultSections } from "@/lib/case/facts";
import { requireStudent } from "@/lib/supabase/server";

export async function createCaseStudy() {
  const { supabase, profile } = await requireStudent();
  const { data, error } = await supabase
    .from("case_studies")
    .insert({ student_id: profile.id, title: "Untitled case study", sections: defaultSections() })
    .select("id")
    .single();
  if (error || !data) throw new Error("The case study couldn't be created. Please try again.");
  redirect(`/case-studies/${data.id}`);
}

export async function duplicateCaseStudy(id: string) {
  const { supabase, profile } = await requireStudent();
  const { data: cs } = await supabase.from("case_studies").select("title, subject_id, facts, sections, deidentified_confirmed").eq("id", id).maybeSingle();
  if (!cs) return { ok: false };
  const { error } = await supabase.from("case_studies").insert({ ...cs, student_id: profile.id, title: `${cs.title} (copy)`.slice(0, 160) });
  revalidatePath("/case-studies");
  return { ok: !error };
}

export async function deleteCaseStudy(id: string) {
  const { supabase } = await requireStudent();
  const { error } = await supabase.from("case_studies").delete().eq("id", id);
  revalidatePath("/case-studies");
  return { ok: !error };
}
