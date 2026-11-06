"use client";

import { createClient } from "@/lib/supabase/client";
import { chunkPages, totalChars } from "./chunk";
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

/** Indexes the remaining text pieces of a document, a small batch at a time. */
export async function runIndexing(documentId: string, onStep: (s: Step) => void) {
  const supabase = createClient();
  for (let attempt = 0, failures = 0; attempt < 2000; attempt++) {
    const { data, error } = await supabase.functions.invoke<{ remaining: number; total: number }>("embed", {
      body: { action: "document", document_id: documentId },
    });
    if (error || !data) {
      failures++;
      if (failures >= 3) throw new Error(await functionError(error));
      await new Promise((r) => setTimeout(r, 1500 * failures));
      continue;
    }
    failures = 0;
    onStep({ label: "Adding it to Nurse Mira's library", done: data.total - data.remaining, total: data.total });
    if (data.remaining === 0) return;
  }
}

export async function uploadDocument(input: UploadInput, onStep: (s: Step) => void): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
