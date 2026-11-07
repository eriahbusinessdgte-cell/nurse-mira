import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocRow } from "@/components/document-list";
import type { SubjectLite, TopicLite } from "./suggest";

export const DOC_COLUMNS =
  "id, title, original_filename, uploader_id, file_path, file_size, visibility, status, processing, processing_error, subject_id, topic_id, source_type, allow_download, chunk_count, page_count, created_at, year_level, semester, sha256, mime_type, unreadable_pages, background";

export async function loadCurriculum(supabase: SupabaseClient) {
  const [{ data: subjects }, { data: topics }] = await Promise.all([
    supabase.from("subjects").select("id, code, title, year_level, semester").eq("is_active", true).order("sort_order"),
    supabase.from("topics").select("id, subject_id, name").eq("is_active", true).order("sort_order"),
  ]);
  return { subjects: (subjects ?? []) as SubjectLite[], topics: (topics ?? []) as TopicLite[] };
}

export type FullDoc = DocRow & { year_level: number | null; semester: number | null; sha256: string };
