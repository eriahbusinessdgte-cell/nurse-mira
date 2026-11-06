"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";

export type Result = { ok: boolean; message: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const ids_ = (ids: string[]) => [...new Set(ids.filter((i) => UUID_RE.test(i)))].slice(0, 500);

function refresh() {
  revalidatePath("/library");
  revalidatePath("/admin/library");
  revalidatePath("/admin/storage");
}

async function log(supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"], actor: string, action: string, details: Record<string, unknown>) {
  await supabase.from("activity_log").insert({ actor_id: actor, action, details });
}

/** Archive or restore (admin only — enforced by the database). */
export async function setArchived(ids: string[], archived: boolean): Promise<Result> {
  const { supabase, profile } = await requireProfile("admin");
  const list = ids_(ids);
  const { error, count } = await supabase
    .from("documents")
    .update({ status: archived ? "archived" : "active", archived_at: archived ? new Date().toISOString() : null }, { count: "exact" })
    .in("id", list);
  if (error) return { ok: false, message: "Couldn't update the documents. Please try again." };
  await log(supabase, profile.id, archived ? "library.archived" : "library.restored", { count });
  refresh();
  return { ok: true, message: `${count} document(s) ${archived ? "archived" : "restored"}.` };
}

export async function setAllowDownload(id: string, allow: boolean): Promise<Result> {
  const { supabase, profile } = await requireProfile("admin");
  const { error } = await supabase.from("documents").update({ allow_download: allow }).eq("id", id).eq("visibility", "shared");
  if (error) return { ok: false, message: "Couldn't change the download setting." };
  await log(supabase, profile.id, allow ? "library.download_on" : "library.download_off", { document_id: id });
  refresh();
  return { ok: true, message: allow ? "Students can now download the original file." : "Original file downloads turned off." };
}

/** Edit title / subject / topic / source type (owner or admin — enforced by the database). */
export async function updateDocument(
  id: string,
  fields: { title: string; subject_id: string | null; topic_id: string | null; source_type: string },
): Promise<Result> {
  const { supabase } = await requireProfile();
  const title = fields.title.trim().slice(0, 300);
  if (!title) return { ok: false, message: "Please enter a title." };
  let year: number | null = null;
  let semester: number | null = null;
  if (fields.subject_id) {
    const { data: s } = await supabase.from("subjects").select("year_level, semester").eq("id", fields.subject_id).single();
    year = s?.year_level ?? null;
    semester = s?.semester ?? null;
  }
  const { error, count } = await supabase
    .from("documents")
    .update(
      { title, subject_id: fields.subject_id, topic_id: fields.topic_id, source_type: fields.source_type, year_level: year, semester },
      { count: "exact" },
    )
    .eq("id", id);
  if (error || !count) return { ok: false, message: "Couldn't save the changes." };
  refresh();
  return { ok: true, message: "Saved." };
}

async function callFiles(supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"], body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<{ count: number; recovered: number }>("library-files", { body });
  if (error || !data) {
    let message = "Something went wrong. Please try again.";
    try {
      const ctx = (error as { context?: Response })?.context;
      const parsed = ctx ? await ctx.json() : null;
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep default */
    }
    return { ok: false as const, message };
  }
  return { ok: true as const, data };
}

/**
 * Permanently deletes documents: the original files, their extracted text and
 * search index, and the records. Students can delete only their own uploads.
 * Runs inside Supabase so even private files are always removed completely.
 */
export async function deleteDocuments(ids: string[]): Promise<Result & { recovered?: number }> {
  const { supabase } = await requireProfile();
  const res = await callFiles(supabase, { action: "delete", ids: ids_(ids) });
  if (!res.ok) return res;
  refresh();
  return { ok: true, message: `${res.data.count} document(s) permanently deleted.`, recovered: res.data.recovered };
}

/**
 * Frees file storage but keeps the extracted text, so Nurse Mira can still
 * learn from the material. Admin only.
 */
export async function keepTextOnly(ids: string[]): Promise<Result & { recovered?: number }> {
  const { supabase } = await requireProfile("admin");
  const res = await callFiles(supabase, { action: "text_only", ids: ids_(ids) });
  if (!res.ok) return res;
  refresh();
  return {
    ok: true,
    message: `Original files removed for ${res.data.count} document(s). Their text stays in Nurse Mira's library.`,
    recovered: res.data.recovered,
  };
}

/** Archive every active document of one semester (admin). */
export async function archiveSemester(year: number, semester: number): Promise<Result> {
  const { supabase, profile } = await requireProfile("admin");
  const { error, count } = await supabase
    .from("documents")
    .update({ status: "archived", archived_at: new Date().toISOString() }, { count: "exact" })
    .eq("year_level", year)
    .eq("semester", semester)
    .eq("status", "active");
  if (error) return { ok: false, message: "Couldn't archive that semester." };
  await log(supabase, profile.id, "library.archived_semester", { year, semester, count });
  refresh();
  return { ok: true, message: `${count ?? 0} document(s) archived. They stay searchable by Nurse Mira at a lower priority.` };
}
