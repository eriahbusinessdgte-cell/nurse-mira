"use server";

import { requireProfile } from "@/lib/supabase/server";
import { saveStudentSubjects } from "@/lib/subjects-server";

export type OnboardingInput = {
  full_name: string;
  preferred_name: string;
  year_level: number;
  current_semester: number;
  subject_ids: string[];
};

export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean; message: string }> {
  const { supabase, profile } = await requireProfile("student");

  const full_name = input.full_name.trim().slice(0, 120);
  const preferred_name = input.preferred_name.trim().slice(0, 60) || null;
  const year = Number(input.year_level);
  const sem = Number(input.current_semester);
  if (!full_name) return { ok: false, message: "Please enter your name." };
  if (!(year >= 1 && year <= 4) || !(sem >= 1 && sem <= 2)) return { ok: false, message: "Please choose your year level and semester." };
  if (!input.subject_ids.length) return { ok: false, message: "Please choose at least one subject." };

  const subjects = await saveStudentSubjects(supabase, profile.id, input.subject_ids);
  if (subjects.error) return { ok: false, message: subjects.error };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, preferred_name, year_level: year, current_semester: sem, onboarding_completed: true })
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't finish setting up. Please try again." };
  return { ok: true, message: "All set!" };
}
