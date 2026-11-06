"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/supabase/server";
import { saveStudentSubjects } from "@/lib/subjects-server";

export async function saveMySubjects(ids: string[]): Promise<{ ok: boolean; message: string }> {
  const { supabase, profile } = await requireStudent();
  if (!ids.length) return { ok: false, message: "Please keep at least one subject." };
  const result = await saveStudentSubjects(supabase, profile.id, ids);
  if (result.error) return { ok: false, message: result.error };
  revalidatePath("/subjects");
  revalidatePath("/dashboard");
  return { ok: true, message: "Your subjects are saved." };
}
