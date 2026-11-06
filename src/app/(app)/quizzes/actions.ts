"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/supabase/server";

export async function deleteQuiz(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireStudent();
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  revalidatePath("/quizzes");
  return { ok: !error };
}
