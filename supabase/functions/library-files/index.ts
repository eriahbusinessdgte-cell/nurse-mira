// Nurse Mira — permanent deletion and "keep text only" for library files.
// Runs inside Supabase with the secret key so files are always removed
// completely, including students' private files the admin cannot open.
//
// Actions:
//   delete     { ids }  -> removes original files, text pieces, search index and records.
//                         Students: own uploads only. Admin: any document.
//   text_only  { ids }  -> admin only: removes original files of shared documents, keeps their text.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
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

  let body: { action?: string; ids?: string[] };
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

    return json(400, { error: "Unknown action." });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Something went wrong. Please try again." });
  }
});
