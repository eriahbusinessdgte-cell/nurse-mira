"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";
import { readName, readYearSemester, saveStudentSubjects } from "@/lib/subjects-server";

export type ActionResult = { ok: boolean; message: string };

export async function updateStudentDetails(studentId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile("admin");
  const name = readName(form);
  if (!name.full_name) return { ok: false, message: "Please enter the student's name." };

  const { error, count } = await supabase
    .from("profiles")
    .update({ ...name, ...readYearSemester(form) }, { count: "exact" })
    .eq("id", studentId)
    .eq("role", "student");
  if (error || !count) return { ok: false, message: "Couldn't save the changes. Please try again." };

  await supabase.from("activity_log").insert({ actor_id: profile.id, action: "student.updated", target_id: studentId });
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true, message: "Saved." };
}

export async function updateStudentSubjects(studentId: string, ids: string[]): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile("admin");
  const result = await saveStudentSubjects(supabase, studentId, ids);
  if (result.error) return { ok: false, message: result.error };
  await supabase.from("activity_log").insert({
    actor_id: profile.id,
    action: "student.subjects_updated",
    target_id: studentId,
    details: { added: result.added, removed: result.removed },
  });
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true, message: "Subjects saved." };
}
