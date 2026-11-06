"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";

export type Result = { ok: boolean; message: string };

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

async function admin() {
  const { supabase, profile } = await requireProfile("admin");
  const log = (action: string, details: Record<string, unknown>) =>
    supabase.from("activity_log").insert({ actor_id: profile.id, action, details });
  return { supabase, log };
}

const done = (message: string): Result => {
  revalidatePath("/admin/curriculum");
  return { ok: true, message };
};

export async function updateSubject(id: string, _prev: Result | null, form: FormData): Promise<Result> {
  const { supabase, log } = await admin();
  const title = clean(form.get("title"), 300);
  const description = String(form.get("description") ?? "").trim().slice(0, 2000) || null;
  if (!title) return { ok: false, message: "Please enter the subject title." };
  const { error } = await supabase.from("subjects").update({ title, description }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't save the subject. Please try again." };
  await log("curriculum.subject_updated", { subject_id: id, title });
  return done("Subject saved.");
}

export async function setSubjectActive(id: string, active: boolean): Promise<Result> {
  const { supabase, log } = await admin();
  const { error } = await supabase.from("subjects").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't update the subject. Please try again." };
  await log(active ? "curriculum.subject_restored" : "curriculum.subject_retired", { subject_id: id });
  return done(active ? "Subject restored." : "Subject retired. Students who already have it keep it in their records.");
}

export async function addSubject(_prev: Result | null, form: FormData): Promise<Result> {
  const { supabase, log } = await admin();
  const code = clean(form.get("code"), 30).toUpperCase();
  const title = clean(form.get("title"), 300);
  const year = Number(form.get("year_level"));
  const sem = Number(form.get("semester"));
  if (!code || !title) return { ok: false, message: "Please enter both the subject code and title." };
  if (!(year >= 1 && year <= 4) || !(sem >= 1 && sem <= 2)) return { ok: false, message: "Please choose the year level and semester." };

  const { data: last } = await supabase.from("subjects").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase
    .from("subjects")
    .insert({ code, title, year_level: year, semester: sem, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? `A subject with the code ${code} already exists.` : "Couldn't add the subject. Please try again.",
    };
  }
  await log("curriculum.subject_added", { code, title });
  return done(`${code} added.`);
}

export async function addTopic(subjectId: string, _prev: Result | null, form: FormData): Promise<Result> {
  const { supabase, log } = await admin();
  const name = clean(form.get("name"), 200);
  if (!name) return { ok: false, message: "Please type a topic name." };
  const { data: last } = await supabase
    .from("topics")
    .select("sort_order")
    .eq("subject_id", subjectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("topics").insert({ subject_id: subjectId, name, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) {
    return { ok: false, message: error.code === "23505" ? `“${name}” is already a topic of this subject.` : "Couldn't add the topic. Please try again." };
  }
  await log("curriculum.topic_added", { subject_id: subjectId, name });
  return done(`Topic “${name}” added.`);
}

export async function renameTopic(id: string, name: string): Promise<Result> {
  const { supabase, log } = await admin();
  const clean_ = name.trim().replace(/\s+/g, " ").slice(0, 200);
  if (!clean_) return { ok: false, message: "The topic name can't be empty." };
  const { error } = await supabase.from("topics").update({ name: clean_ }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "That topic name is already used in this subject." : "Couldn't rename the topic." };
  await log("curriculum.topic_renamed", { topic_id: id, name: clean_ });
  return done("Topic renamed.");
}

export async function setTopicActive(id: string, active: boolean): Promise<Result> {
  const { supabase, log } = await admin();
  const { error } = await supabase.from("topics").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't update the topic." };
  await log(active ? "curriculum.topic_restored" : "curriculum.topic_retired", { topic_id: id });
  return done(active ? "Topic restored." : "Topic retired.");
}
