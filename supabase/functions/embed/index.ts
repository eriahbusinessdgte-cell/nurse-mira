// Nurse Mira — search index builder (runs inside Supabase, no outside AI service).
// Uses the free gte-small model built into Supabase Edge Functions.
//
// Actions:
//   document { document_id }  -> index the next small batch of text pieces; returns how many remain.
//                                Called repeatedly by the uploader's browser (2-second CPU limit per call).
//   query    { text }         -> embedding for a search question (used by the AI Tutor and search).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BATCH = 6;

// deno-lint-ignore no-explicit-any
const model = new (globalThis as any).Supabase.ai.Session("gte-small");

const ALLOWED = ["https://nurse-mira.vercel.app", "http://localhost:3000"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (origin: string | null, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

const embed = async (text: string): Promise<number[]> =>
  await model.run(text.slice(0, 2000), { mean_pool: true, normalize: true });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return json(origin, 401, { error: "Please sign in again." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role, is_active").eq("id", who.user.id).single();
  if (!me?.is_active) return json(origin, 403, { error: "Your account is turned off." });

  let body: { action?: string; document_id?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return json(origin, 400, { error: "The request was not readable." });
  }

  try {
    if (body.action === "query") {
      const text = String(body.text ?? "").trim();
      if (!text) return json(origin, 400, { error: "Nothing to search for." });
      return json(origin, 200, { embedding: await embed(text) });
    }

    if (body.action === "document") {
      const id = String(body.document_id ?? "");
      const { data: doc } = await admin.from("documents").select("id, uploader_id, processing").eq("id", id).single();
      if (!doc) return json(origin, 404, { error: "Document not found." });
      if (doc.uploader_id !== who.user.id && me.role !== "admin") return json(origin, 403, { error: "Not your document." });

      const { data: batch, error } = await admin
        .from("document_chunks")
        .select("id, content")
        .eq("document_id", id)
        .is("embedding", null)
        .order("chunk_index")
        .limit(BATCH);
      if (error) throw error;

      for (const chunk of batch ?? []) {
        const vector = await embed(chunk.content);
        const { error: upErr } = await admin.from("document_chunks").update({ embedding: JSON.stringify(vector) }).eq("id", chunk.id);
        if (upErr) throw upErr;
      }

      const { count: remaining } = await admin
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", id)
        .is("embedding", null);
      const { count: total } = await admin.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", id);

      if ((remaining ?? 0) === 0) {
        await admin
          .from("documents")
          .update({ processing: "ready", processing_error: null, chunk_count: total ?? 0 })
          .eq("id", id);
      }
      return json(origin, 200, { remaining: remaining ?? 0, total: total ?? 0 });
    }

    return json(origin, 400, { error: "Unknown action." });
  } catch (e) {
    console.error(e);
    return json(origin, 500, { error: "Indexing hit a problem. Please try again." });
  }
});
