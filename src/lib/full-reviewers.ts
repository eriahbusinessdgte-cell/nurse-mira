import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocOption, ReviewerRow, ReviewerSummary } from "@/components/full-reviewers";

/** Library documents a full reviewer can be made from, the reviewers this person can see, and the one asked for. */
export async function loadFullReviewers(supabase: SupabaseClient, openId: string | null) {
  const [{ data: docs }, { data: rows }, opened] = await Promise.all([
    supabase.from("documents").select("id, title, page_count, chunk_count").eq("processing", "ready").eq("background", false).gt("chunk_count", 0).order("title"),
    supabase.from("full_reviewers").select("id, document_id, created_by, shared, title, status, created_at, parts_total, parts_done").order("created_at", { ascending: false }),
    openId ? supabase.from("full_reviewers").select("*").eq("id", openId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reviewers: ReviewerSummary[] = (rows ?? []).map((r) => ({ ...r, total: r.parts_total, done: r.parts_done }) as ReviewerSummary);
  return { docs: (docs ?? []) as DocOption[], reviewers, initial: (opened.data as ReviewerRow | null) ?? null };
}
