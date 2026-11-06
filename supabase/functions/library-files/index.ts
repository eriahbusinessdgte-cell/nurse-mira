// Nurse Mira — permanent deletion, "keep text only", and "make smaller" for library files.
// Runs inside Supabase with the secret key so files are always handled completely,
// including files in other students' folders that the admin cannot write to directly.
//
// Actions:
//   delete     { ids }  -> removes original files, text pieces, search index and records.
//                         Students: own uploads only. Admin: any document.
//   text_only  { ids }  -> admin only: removes original files of shared documents, keeps their text.
//   replace_file { ids: [id], file: base64, kind, name }
//                      -> swaps the stored file for a smaller copy made in the browser.
//                         Uploader or admin; the new file must be a PDF/JPEG and smaller.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED = ["https://nurse-mira.vercel.app", "http://localhost:3000"];
let corsHeaders: Record<string, string> = {};
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f-]{36}$/i;
const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "file";

Deno.serve(async (req) => {
  corsHeaders = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return json(401, { error: "Please sign in again." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role, is_active").eq("id", who.user.id).single();
  if (!me?.is_active) return json(403, { error: "Your account is turned off." });
  const isAdmin = me.role === "admin";

  let body: { action?: string; ids?: string[]; file?: string; kind?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "The request was not readable." });
  }
  const ids = [...new Set((body.ids ?? []).filter((i) => typeof i === "string" && UUID_RE.test(i)))].slice(0, 500);
  if (!ids.length) return json(400, { error: "No documents chosen." });

  const { data: docs, error } = await admin
    .from("documents")
    .select("id, uploader_id, file_path, file_size, title, visibility")
    .in("id", ids);
  if (error) return json(500, { error: "Couldn't read the documents." });

  const log = (action: string, details: Record<string, unknown>) =>
    admin.from("activity_log").insert({ actor_id: who.user.id, action, details });

  try {
    if (body.action === "delete") {
      const allowed = (docs ?? []).filter((d) => isAdmin || d.uploader_id === who.user.id);
      if (!allowed.length) return json(403, { error: "You can only delete your own uploads." });
      const paths = allowed.map((d) => d.file_path).filter(Boolean) as string[];
      if (paths.length) {
        const { error: sErr } = await admin.storage.from("documents").remove(paths);
        if (sErr) return json(500, { error: "The files couldn't be removed from storage. Nothing was deleted. Please try again." });
      }
      const { error: dErr } = await admin.from("documents").delete().in("id", allowed.map((d) => d.id));
      if (dErr) {
        await admin.from("documents").update({ file_path: null }).in("id", allowed.map((d) => d.id));
        return json(500, { error: "The files were removed, but the records couldn't be deleted. Please try again." });
      }
      const recovered = allowed.reduce((n, d) => n + (d.file_path ? Number(d.file_size) : 0), 0);
      await log("library.deleted", { count: allowed.length, titles: allowed.map((d) => d.title).slice(0, 20) });
      return json(200, { count: allowed.length, recovered });
    }

    if (body.action === "text_only") {
      if (!isAdmin) return json(403, { error: "Only the administrator can do this." });
      const targets = (docs ?? []).filter((d) => d.visibility === "shared" && d.file_path);
      if (!targets.length) return json(400, { error: "None of those documents have an original file to remove." });
      const { error: sErr } = await admin.storage.from("documents").remove(targets.map((d) => d.file_path as string));
      if (sErr) return json(500, { error: "Couldn't remove the files. Please try again." });
      await admin.from("documents").update({ file_path: null, allow_download: false }).in("id", targets.map((d) => d.id));
      const recovered = targets.reduce((n, d) => n + Number(d.file_size), 0);
      await log("library.text_only", { count: targets.length, recovered });
      return json(200, { count: targets.length, recovered });
    }

    if (body.action === "replace_file") {
      const doc = docs?.[0];
      if (!doc || docs!.length !== 1) return json(400, { error: "Choose one document." });
      if (!isAdmin && doc.uploader_id !== who.user.id) return json(403, { error: "You can only change your own uploads." });
      if (!doc.file_path || !doc.uploader_id) return json(400, { error: "This document has no stored file." });
      const kind = body.kind === "application/pdf" || body.kind === "image/jpeg" ? body.kind : null;
      if (!kind || typeof body.file !== "string") return json(400, { error: "The smaller copy wasn't sent correctly." });
      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(body.file);
      } catch {
        return json(400, { error: "The smaller copy wasn't sent correctly." });
      }
      const looksRight = kind === "application/pdf" ? new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-" : bytes[0] === 0xff && bytes[1] === 0xd8;
      if (!looksRight) return json(400, { error: "The smaller copy isn't a valid file." });
      if (bytes.length >= Number(doc.file_size)) return json(400, { error: "The new copy isn't smaller, so nothing was changed." });

      const base = safeName(String(body.name ?? "file")).replace(/\.(pdf|jpe?g|png)$/i, "");
      const newPath = `${doc.uploader_id}/${doc.id}/${base}-small.${kind === "application/pdf" ? "pdf" : "jpg"}`;
      if (newPath === doc.file_path) return json(400, { error: "This file was already made smaller." });
      const { error: upErr } = await admin.storage.from("documents").upload(newPath, bytes, { contentType: kind, upsert: true });
      if (upErr) return json(500, { error: "The smaller copy couldn't be saved. Nothing was changed." });
      const { error: dbErr } = await admin.from("documents").update({ file_path: newPath, file_size: bytes.length, mime_type: kind }).eq("id", doc.id);
      if (dbErr) {
        await admin.storage.from("documents").remove([newPath]);
        return json(500, { error: "The document couldn't be updated. Nothing was changed." });
      }
      await admin.storage.from("documents").remove([doc.file_path]);
      const recovered = Number(doc.file_size) - bytes.length;
      await log("library.made_smaller", { title: doc.title, before: Number(doc.file_size), after: bytes.length });
      return json(200, { before: Number(doc.file_size), after: bytes.length, recovered });
    }

    return json(400, { error: "Unknown action." });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Something went wrong. Please try again." });
  }
});
