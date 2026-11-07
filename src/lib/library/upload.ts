"use client";

import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { chunkPages, totalChars, type Page } from "./chunk";
import { isReferenceChunk } from "./textbook";
import type { Extracted } from "./extract";

export type UploadInput = {
  file: File; // the file to store (may be a smaller copy)
  originalName: string;
  kind: string; // mime type of the stored file
  sha256: string;
  extracted: Extracted;
  visibility: "shared" | "private";
  title: string;
  subject_id: string | null;
  topic_id: string | null;
  year_level: number | null;
  semester: number | null;
  source_type: string;
  rights_confirmed: boolean;
};

export type Step = { label: string; detail?: string; done?: number; total?: number };

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "file";

async function functionError(error: unknown) {
  try {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json() : null;
    if (body?.error) return String(body.error);
  } catch {
    /* ignore */
  }
  return "Indexing hit a problem.";
}

/**
 * Indexes the remaining text pieces of a document, a small batch at a time. (Lanes > 1 run
 * side by side, but the free plan refuses that with "too busy", so everything uses 1 lane.)
 */
export async function runIndexing(documentId: string, onStep: (s: Step) => void, lanes = 1) {
  // Note: parallel lanes overload the free plan's function workers (HTTP 546), so callers use 1.
  const supabase = createClient();
  const { count } = await supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", documentId);
  const total = count ?? 0;
  const useLanes = lanes > 1 && total > 300 ? lanes : 1;
  const size = Math.ceil(total / useLanes);
  let lastRemaining = total;

  const lane = async (from: number | null, to: number | null) => {
    let batch = 6; // pieces per call; shrinks after a failure (heavy pages), grows back slowly
    let streak = 0;
    for (let attempt = 0, failures = 0; attempt < 6000; attempt++) {
      const { data, error } = await supabase.functions.invoke<{ remaining: number; total: number; lane_remaining: number | null }>("embed", {
        body: { action: "document", document_id: documentId, batch, ...(from !== null ? { from_index: from, to_index: to } : {}) },
      });
      if (error || !data) {
        // The free plan sometimes says "too busy" for a moment: wait longer each time, then give up.
        failures++;
        streak = 0;
        batch = Math.max(1, Math.floor(batch / 2));
        if (failures >= 8) {
          const message = await functionError(error);
          reportProblem("embed", problemKind(null, true), message);
          throw new Error(message);
        }
        onStep({ label: "The server is busy — waiting a moment, then continuing", done: total - lastRemaining, total });
        await new Promise((r) => setTimeout(r, Math.min(30_000, 2000 * 2 ** (failures - 1))));
        continue;
      }
      failures = 0;
      if (++streak >= 10 && batch < 6) {
        batch++;
        streak = 0;
      }
      lastRemaining = Math.min(lastRemaining, data.remaining);
      onStep({ label: "Adding it to Nurse Mira's library", done: data.total - lastRemaining, total: data.total });
      if ((data.lane_remaining ?? data.remaining) === 0) return;
    }
  };

  if (useLanes === 1) return lane(null, null);
  await Promise.all(Array.from({ length: useLanes }, (_, i) => lane(i * size, (i + 1) * size)));
}

export async function uploadDocument(input: UploadInput, onStep: (s: Step) => void): Promise<string> {
  const supabase = createClient();
  const user = (await supabase.auth.getSession()).data.session?.user;
  if (!user) throw new Error("Please sign in again.");

  const chunks = chunkPages(input.extracted.pages);
  if (chunks.length === 0) throw new Error("No readable text was found in this file.");

  // 1. Record
  onStep({ label: "Saving details" });
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      uploader_id: user.id,
      title: input.title.trim().slice(0, 300),
      original_filename: input.originalName.slice(0, 255),
      mime_type: input.kind,
      file_size: input.file.size,
      sha256: input.sha256,
      visibility: input.visibility,
      subject_id: input.subject_id,
      topic_id: input.topic_id,
      year_level: input.year_level,
      semester: input.semester,
      source_type: input.source_type,
      rights_confirmed: input.rights_confirmed,
      page_count: input.extracted.pageCount,
      text_chars: totalChars(input.extracted.pages),
      unreadable_pages: input.extracted.unreadablePages,
      processing: "uploading",
    })
    .select("id")
    .single();
  if (insertError || !doc) throw new Error("Couldn't save the document details. Please try again.");
  const id = doc.id as string;

  const fail = async (message: string) => {
    await supabase.from("documents").update({ processing: "failed", processing_error: message }).eq("id", id);
    throw new Error(message);
  };

  // 2. Original file
  onStep({ label: "Uploading the file" });
  const path = `${user.id}/${id}/${safeName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, input.file, {
    contentType: input.kind,
    upsert: false,
  });
  if (uploadError) {
    const tooBig = uploadError.message.toLowerCase().includes("size");
    return fail(tooBig ? "The file is too large for storage. Please upload a smaller file." : "The file couldn't be uploaded. Check your internet and try again.");
  }
  await supabase.from("documents").update({ file_path: path, processing: "processing" }).eq("id", id);

  // 3. Text pieces
  onStep({ label: "Saving the text", done: 0, total: chunks.length });
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100).map((c) => ({ ...c, document_id: id }));
    const { error } = await supabase.from("document_chunks").insert(batch);
    if (error) return fail("The text couldn't be saved. Please try again.");
  }
  await supabase.from("documents").update({ chunk_count: chunks.length }).eq("id", id);

  // 4. Search index
  try {
    await runIndexing(id, onStep);
  } catch (e) {
    return fail(`${(e as Error).message} You can press Retry to continue where it stopped.`);
  }
  return id;
}

/** Retry button: continues indexing a document whose text is already saved. */
export async function retryIndexing(documentId: string, onStep: (s: Step) => void) {
  const supabase = createClient();
  const { count } = await supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", documentId);
  if (!count) throw new Error("This upload didn't finish saving. Please delete it and upload the file again.");
  await supabase.from("documents").update({ processing: "processing", processing_error: null }).eq("id", documentId);
  try {
    await runIndexing(documentId, onStep);
  } catch (e) {
    const message = `${(e as Error).message} Please try again later.`;
    await supabase.from("documents").update({ processing: "failed", processing_error: message }).eq("id", documentId);
    throw new Error(message);
  }
}

/**
 * "Read again" button: downloads the stored file, reads every page again (including
 * handwriting), replaces the document's text pieces and rebuilds its search index.
 */
export async function rereadDocument(
  doc: { id: string; file_path: string | null; mime_type: string; original_filename: string },
  onStep: (s: Step) => void,
): Promise<{ unreadable: number[]; notice?: string }> {
  if (!doc.file_path) throw new Error("The original file isn't stored any more, so it can't be read again.");
  const supabase = createClient();
  onStep({ label: "Getting the file" });
  const { data: blob, error } = await supabase.storage.from("documents").download(doc.file_path);
  if (error || !blob) throw new Error("The file couldn't be downloaded. Please try again.");
  const file = new File([blob], doc.original_filename, { type: doc.mime_type });

  const { extractText } = await import("./extract");
  const extracted = await extractText(file, (message) => onStep({ label: message }));
  const chunks = chunkPages(extracted.pages);
  if (chunks.length === 0) throw new Error(extracted.notice ?? "No readable text was found. Nothing was changed.");

  onStep({ label: "Replacing the old text" });
  const { error: delError } = await supabase.from("document_chunks").delete().eq("document_id", doc.id);
  if (delError) throw new Error("The old text couldn't be removed. Nothing was changed.");
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100).map((c) => ({ ...c, document_id: doc.id }));
    const { error: insError } = await supabase.from("document_chunks").insert(batch);
    if (insError) {
      await supabase.from("documents").update({ processing: "failed", processing_error: "The new text couldn't be saved. Press Read again to retry." }).eq("id", doc.id);
      throw new Error("The new text couldn't be saved. Please press Read again.");
    }
  }
  await supabase
    .from("documents")
    .update({
      chunk_count: chunks.length,
      text_chars: totalChars(extracted.pages),
      unreadable_pages: extracted.unreadablePages,
      processing: "processing",
      processing_error: null,
    })
    .eq("id", doc.id);
  try {
    await runIndexing(doc.id, onStep);
  } catch (e) {
    const message = `${(e as Error).message} You can press Retry to continue where it stopped.`;
    await supabase.from("documents").update({ processing: "failed", processing_error: message }).eq("id", doc.id);
    throw new Error(message);
  }
  return { unreadable: extracted.unreadablePages, notice: extracted.notice };
}

/** "Make smaller" button: replaces a stored photo-heavy file with a smaller copy made in this browser. */
export async function shrinkStoredDocument(
  doc: { id: string; file_path: string | null; mime_type: string; original_filename: string; page_count: number | null },
  onStep: (s: Step) => void,
): Promise<{ before: number; after: number }> {
  if (!doc.file_path) throw new Error("The original file isn't stored any more.");
  const supabase = createClient();
  onStep({ label: "Getting the file" });
  const { data: blob, error } = await supabase.storage.from("documents").download(doc.file_path);
  if (error || !blob) throw new Error("The file couldn't be downloaded. Please try again.");
  const file = new File([blob], doc.original_filename, { type: doc.mime_type });

  const { maybeShrink } = await import("./shrink");
  // Treat every page as a photo page: the button only appears for photo-heavy files.
  const smaller = await maybeShrink(file, doc.mime_type, doc.page_count, doc.page_count ?? 1, (m) => onStep({ label: m }));
  if (!smaller) throw new Error("This file can't be made noticeably smaller, so it was left as it is.");

  onStep({ label: "Saving the smaller copy" });
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(smaller);
  });
  const { data, error: fnError } = await supabase.functions.invoke<{ before: number; after: number; error?: string }>("library-files", {
    body: { action: "replace_file", ids: [doc.id], file: base64, kind: smaller.type, name: doc.original_filename },
  });
  if (fnError || !data || data.error) throw new Error(data?.error ?? (await functionError(fnError)));
  return { before: data.before, after: data.after };
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Admin button: swaps a photographed file for a typed Word copy of the text already in the library. */
export async function replaceWithTypedCopy(
  doc: { id: string; title: string; original_filename: string; file_path: string | null },
  onStep: (s: Step) => void,
): Promise<{ before: number; after: number }> {
  if (!doc.file_path) throw new Error("The original file isn't stored any more.");
  const supabase = createClient();
  onStep({ label: "Collecting the typed text" });
  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("chunk_index, page_number, content")
    .eq("document_id", doc.id)
    .order("chunk_index")
    .limit(5000);
  if (error || !chunks?.length) throw new Error("No typed text was found for this document, so nothing was changed.");

  const { rebuildText } = await import("./typed-copy");
  const { makeDocx } = await import("./make-docx");
  onStep({ label: "Making the Word copy" });
  const blob = await makeDocx(doc.title, rebuildText(chunks));

  onStep({ label: "Saving the Word copy" });
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const { data, error: fnError } = await supabase.functions.invoke<{ before: number; after: number; error?: string }>("library-files", {
    body: { action: "replace_file", ids: [doc.id], file: base64, kind: DOCX, name: doc.original_filename },
  });
  if (fnError || !data || data.error) throw new Error(data?.error ?? (await functionError(fnError)));
  return { before: data.before, after: data.after };
}

export type TextbookInput = { file: File; title: string; author: string; license: string; sha256: string; background?: boolean };

/** Hidden "background knowledge" is cited to students only under this name, with no page numbers. */
export const BACKGROUND_TITLE = "Nurse Mira review notes";
export type TextbookResult = { id: string; pages: number; skipped: number; pieces: number };

/**
 * Admin only: adds a large openly licensed textbook as TEXT ONLY (the PDF itself isn't stored —
 * it would use most of the free storage). Page numbers are kept so answers can cite them.
 */
export async function importTextbook(
  input: TextbookInput,
  onStep: (s: Step) => void,
  preparePages: (file: File, onProgress: (m: string) => void) => Promise<{ pages: Page[]; pageCount: number; skipped: number }>,
): Promise<TextbookResult> {
  const supabase = createClient();
  const user = (await supabase.auth.getSession()).data.session?.user;
  if (!user) throw new Error("Please sign in again.");

  const { data: dup } = await supabase.rpc("find_shared_duplicate", { p_sha256: input.sha256 });
  if (Array.isArray(dup) && dup.length) throw new Error(`This book is already in the library as “${dup[0].title}”.`);

  const { pages, pageCount, skipped } = await preparePages(input.file, (m) => onStep({ label: m }));
  // Leave out reference lists (web addresses only), then number the pieces again.
  const chunks = chunkPages(pages)
    .filter((c) => !isReferenceChunk(c.content))
    .map((c, i) => ({ ...c, chunk_index: i, page_number: input.background ? null : c.page_number }));
  const credit = `${input.author.trim()}${input.license.trim() ? ` · ${input.license.trim()}` : ""}`;
  if (chunks.length < 20) throw new Error("Very little typed text was found. This import is for textbooks with selectable text, not scans.");

  onStep({ label: "Saving details" });
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      uploader_id: user.id,
      title: input.background ? BACKGROUND_TITLE : input.title.trim().slice(0, 300),
      original_filename: input.file.name.slice(0, 255),
      mime_type: "application/pdf",
      background: !!input.background,
      file_size: 0,
      sha256: input.sha256,
      visibility: "shared",
      source_type: input.background ? "review_center" : "textbook",
      author: (input.background ? `${input.title.trim()} · ${credit}` : credit).slice(0, 200),
      rights_confirmed: true,
      allow_download: false,
      page_count: pageCount,
      text_chars: totalChars(pages),
      unreadable_pages: [],
      processing: "processing",
    })
    .select("id")
    .single();
  if (error || !doc) throw new Error("Couldn't save the book's details. Please try again.");
  const id = doc.id as string;

  const fail = async (message: string) => {
    await supabase.from("documents").update({ processing: "failed", processing_error: message }).eq("id", id);
    throw new Error(message);
  };

  for (let i = 0; i < chunks.length; i += 250) {
    onStep({ label: "Saving the text", done: i, total: chunks.length });
    const { error: e } = await supabase.from("document_chunks").insert(chunks.slice(i, i + 250).map((c) => ({ ...c, document_id: id })));
    if (e) {
      await supabase.from("document_chunks").delete().eq("document_id", id);
      await supabase.from("documents").delete().eq("id", id);
      throw new Error("The text couldn't be saved. Nothing was added — please try again.");
    }
  }
  await supabase.from("documents").update({ chunk_count: chunks.length }).eq("id", id);

  try {
    await runIndexing(id, onStep);
  } catch (e) {
    return fail(`${(e as Error).message} Press Retry on the book in the library to continue where it stopped.`);
  }
  return { id, pages: pageCount, skipped, pieces: chunks.length };
}
