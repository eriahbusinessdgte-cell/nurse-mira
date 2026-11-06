// Nurse Mira — full backup and restore (admin only).
//
// The browser asks for one table at a time, then encrypts everything with the admin's
// backup password before it is downloaded. The server never sees the password and the
// app never shows the backup's contents — it is only used to put lost records back.
//
// Actions:
//   export  { table, offset }        -> up to 1,000 rows of one table (search index left out:
//                                       it is rebuilt from the text after a restore).
//   restore { table, rows, dry_run } -> puts back rows that are MISSING, never changes or
//                                       removes anything that exists. dry_run only counts.
//   done    {}                       -> records the time of the last finished backup.
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Restore order matters: a row can only go back after the rows it points to.
// key = primary key columns. omit = columns the database fills in itself.
type Spec = { key: string[]; omit?: string[]; select?: string; order: string };
const TABLES: Record<string, Spec> = {
  subjects: { key: ["id"], order: "id" },
  topics: { key: ["id"], order: "id" },
  profiles: { key: ["id"], order: "id" },
  student_subjects: { key: ["student_id", "subject_id"], order: "student_id" },
  app_settings: { key: ["key"], order: "key" },
  documents: { key: ["id"], order: "id" },
  document_chunks: {
    key: ["document_id", "chunk_index"],
    omit: ["id", "embedding", "fts"],
    select: "document_id, chunk_index, page_number, content",
    order: "id",
  },
  conversations: { key: ["id"], order: "id" },
  messages: { key: ["conversation_id"], omit: ["id"], order: "id" },
  ai_usage: { key: ["student_id", "day"], order: "day" },
  review_sheets: { key: ["id"], order: "id" },
  quizzes: { key: ["id"], order: "id" },
  quiz_attempts: { key: ["id"], order: "id" },
  case_studies: { key: ["id"], order: "id" },
  care_plans: { key: ["id"], order: "id" },
  planner_items: { key: ["id"], order: "id" },
  cloudflare_usage: { key: ["day"], order: "day" },
};
const PAGE = 1000;

type Row = Record<string, unknown>;
const keyOf = (row: Row, cols: string[]) => cols.map((c) => String(row[c] ?? "")).join("|");

Deno.serve(async (req) => {
  corsHeaders = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return json(401, { error: "Please sign in again." });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await db.from("profiles").select("role, is_active").eq("id", who.user.id).single();
  if (!me?.is_active || me.role !== "admin") return json(403, { error: "Only the admin can make or restore backups." });

  let body: { action?: string; table?: string; offset?: number; rows?: Row[]; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "The request was not readable." });
  }

  try {
    if (body.action === "done") {
      const now = new Date().toISOString();
      await db.from("app_settings").upsert({ key: "last_backup_at", value: now });
      await db.from("activity_log").insert({ actor_id: who.user.id, action: "backup.downloaded", details: {} });
      return json(200, { last_backup_at: now });
    }

    const table = String(body.table ?? "");
    const spec = TABLES[table];
    if (!spec) return json(400, { error: "Unknown table." });

    if (body.action === "export") {
      const offset = Math.max(0, Math.floor(Number(body.offset ?? 0)));
      const { data, error } = await db
        .from(table)
        .select(spec.select ?? "*")
        .order(spec.order)
        .order(spec.key[spec.key.length - 1])
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      return json(200, { rows: data ?? [], more: (data?.length ?? 0) === PAGE });
    }

    if (body.action === "restore") {
      const dry = body.dry_run !== false;
      const rows = (Array.isArray(body.rows) ? body.rows : []).filter((r) => r && typeof r === "object").slice(0, 5000);
      const result = await restore(db, table, spec, rows, dry);
      if (!dry && result.added > 0) {
        await db.from("activity_log").insert({
          actor_id: who.user.id,
          action: "backup.restored",
          details: { table, added: result.added },
        });
      }
      return json(200, result);
    }

    return json(400, { error: "Unknown action." });
  } catch (e) {
    console.error(e);
    return json(500, { error: "The backup hit a problem. Please try again." });
  }
});

// deno-lint-ignore no-explicit-any
type Db = any;
type Result = { table: string; in_backup: number; missing: number; added: number; failed: number; reindex: string[]; note?: string };

async function restore(db: Db, table: string, spec: Spec, rows: Row[], dry: boolean): Promise<Result> {
  const out: Result = { table, in_backup: rows.length, missing: 0, added: 0, failed: 0, reindex: [] };
  if (!rows.length) return out;

  let missing: Row[];
  if (table === "document_chunks" || table === "messages") {
    // Text pieces and chat messages have no lasting id of their own, so they are put back
    // only for a document or chat that has none at all (all-or-nothing per parent).
    const parentCol = table === "document_chunks" ? "document_id" : "conversation_id";
    const parentTable = table === "document_chunks" ? "documents" : "conversations";
    const parents = [...new Set(rows.map((r) => String(r[parentCol])))];
    const existingParents = await idsIn(db, parentTable, parents);
    const wanted = new Set<string>();
    for (const p of parents) {
      if (!existingParents.has(p)) continue;
      const { count, error } = await db.from(table).select(parentCol, { count: "exact", head: true }).eq(parentCol, p);
      if (error) throw error;
      if (!count) wanted.add(p);
    }
    missing = rows.filter((r) => wanted.has(String(r[parentCol])));
    if (table === "document_chunks") out.reindex = [...wanted].filter((p) => missing.some((r) => r[parentCol] === p));
  } else {
    const existing = await rowsIn(db, table, spec.key, rows);
    missing = rows.filter((r) => !existing.has(keyOf(r, spec.key)));
  }

  if (table === "profiles" && missing.length) {
    // A profile can only come back if its sign-in account still exists.
    const kept: Row[] = [];
    for (const r of missing) {
      const { data } = await db.auth.admin.getUserById(String(r.id));
      if (data?.user) kept.push(r);
    }
    if (kept.length < missing.length) out.note = `${missing.length - kept.length} account(s) no longer exist and can't be restored — invite them again.`;
    missing = kept;
  }

  out.missing = missing.length;
  if (dry || !missing.length) return out;

  const clean = missing.map((r) => {
    const c = { ...r };
    for (const col of spec.omit ?? []) delete c[col];
    return c;
  });

  // Insert in batches; if a batch is refused, try its rows one by one so one bad row
  // (for example, work of a student who was deleted) doesn't block the others.
  for (let i = 0; i < clean.length; i += 200) {
    const batch = clean.slice(i, i + 200);
    const { error } = await db.from(table).insert(batch);
    if (!error) {
      out.added += batch.length;
      continue;
    }
    for (const r of batch) {
      const { error: one } = await db.from(table).insert(r);
      if (one) out.failed += 1;
      else out.added += 1;
    }
  }

  if (table === "documents") {
    // The original files aren't inside the backup. If a restored record's file is gone
    // from storage, clear the link so nobody gets a broken download.
    for (const r of missing) {
      const path = typeof r.file_path === "string" ? r.file_path : "";
      if (!path) continue;
      const slash = path.lastIndexOf("/");
      const { data } = await db.storage.from("documents").list(path.slice(0, slash), { search: path.slice(slash + 1) });
      if (!(data ?? []).some((f: { name: string }) => f.name === path.slice(slash + 1))) {
        await db.from("documents").update({ file_path: null }).eq("id", r.id);
      }
    }
  }

  if (table === "document_chunks" && out.reindex.length) {
    await db
      .from("documents")
      .update({ processing: "failed", processing_error: "Restored from a backup. Press Retry to rebuild its search." })
      .in("id", out.reindex);
  }
  return out;
}

async function idsIn(db: Db, table: string, values: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < values.length; i += 200) {
    const { data, error } = await db.from(table).select("id").in("id", values.slice(i, i + 200));
    if (error) throw error;
    for (const r of data ?? []) found.add(String(r.id));
  }
  return found;
}

// Which of these rows already exist? Checked 100 rows at a time, matching on every key
// column, so each lookup stays well under the 1,000-row answer limit.
async function rowsIn(db: Db, table: string, key: string[], rows: Row[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < rows.length; i += 100) {
    const part = rows.slice(i, i + 100);
    let q = db.from(table).select(key.join(", "));
    for (const col of key) q = q.in(col, [...new Set(part.map((r) => String(r[col])))]);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data ?? []) found.add(keyOf(r, key));
  }
  return found;
}
