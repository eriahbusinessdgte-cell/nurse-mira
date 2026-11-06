import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Makes a student's subject list exactly `ids`. Database rules decide who may do this. */
export async function saveStudentSubjects(supabase: SupabaseClient, studentId: string, ids: string[]) {
  const wanted = [...new Set(ids.filter((id) => UUID_RE.test(id)))];

  const { data: current, error: readError } = await supabase
    .from("student_subjects")
    .select("subject_id")
    .eq("student_id", studentId);
  if (readError) return { error: "Couldn't read the current subjects. Please try again." };

  const have = new Set((current ?? []).map((r) => r.subject_id as string));
  const toAdd = wanted.filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !wanted.includes(id));

  if (toRemove.length) {
    const { error } = await supabase.from("student_subjects").delete().eq("student_id", studentId).in("subject_id", toRemove);
    if (error) return { error: "Couldn't remove some subjects. Please try again." };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("student_subjects").insert(toAdd.map((subject_id) => ({ student_id: studentId, subject_id })));
    if (error) return { error: "Couldn't add some subjects. Please try again." };
  }
  return { error: null, added: toAdd.length, removed: toRemove.length };
}

/** Reads and checks year / semester values from a form. */
export function readYearSemester(form: FormData) {
  const y = Number(form.get("year_level"));
  const s = Number(form.get("current_semester"));
  return {
    year_level: y >= 1 && y <= 4 ? y : null,
    current_semester: s >= 1 && s <= 2 ? s : null,
  };
}

export function readName(form: FormData) {
  const full_name = String(form.get("full_name") ?? "").trim().slice(0, 120);
  const preferredRaw = String(form.get("preferred_name") ?? "").trim().slice(0, 60);
  return { full_name, preferred_name: preferredRaw || null };
}
