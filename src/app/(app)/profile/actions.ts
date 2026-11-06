"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";
import { readName, readYearSemester } from "@/lib/subjects-server";

export async function saveMyProfile(_prev: { ok: boolean; message: string } | null, form: FormData) {
  const { supabase, profile } = await requireProfile();
  const name = readName(form);
  if (!name.full_name) return { ok: false, message: "Please enter your name." };

  const update: Record<string, unknown> = { ...name };
  if (profile.role === "student") {
    const ys = readYearSemester(form);
    if (!ys.year_level || !ys.current_semester) return { ok: false, message: "Please choose your year level and semester." };
    Object.assign(update, ys);
  }
  const { error } = await supabase.from("profiles").update(update).eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save your profile. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}
