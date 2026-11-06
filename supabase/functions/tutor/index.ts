// Nurse Mira — AI Tutor (runs inside Supabase; the Groq key never reaches the browser).
//
// POST { conversation_id?, message, mode: "tea"|"clinical", subject_id? }
//  -> { conversation_id, message: {...}, remaining }
//  or { error, kind: "limit" | "unavailable" | "invalid" }
//
// Steps: check the student and their daily limit → search the shared library →
// ask Groq (main model, then a smaller backup model) → save both messages →
// keep a short study summary for "Continue Studying".
import { createClient } from "npm:@supabase/supabase-js@2";
import { isSafetyTopic, summaryPrompt, systemPrompt, type Source } from "./prompt.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const MAIN_MODEL = "openai/gpt-oss-120b";
const BACKUP_MODEL = "openai/gpt-oss-20b";
const YEAR = ["", "First Year", "Second Year", "Third Year", "Fourth Year"];

// deno-lint-ignore no-explicit-any
const embedder = new (globalThis as any).Supabase.ai.Session("gte-small");

const ALLOWED = ["https://nurse-mira.vercel.app", "http://localhost:3000"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (origin: string | null, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

const manilaDay = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function groq(model: string, messages: ChatMessage[], opts: { maxTokens: number; json?: boolean; temperature?: number }) {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_completion_tokens: opts.maxTokens,
    reasoning_effort: "low",
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(new Error(`Groq ${res.status}`), { status: res.status, detail: detail.slice(0, 300) });
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw Object.assign(new Error("Empty answer"), { status: 502 });
  return text.trim();
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(origin, 405, { error: "Method not allowed.", kind: "invalid" });

  // 1. Who is asking?
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return json(origin, 401, { error: "Please sign in again.", kind: "invalid" });
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await db.from("profiles").select("id, full_name, preferred_name, role, is_active, year_level").eq("id", who.user.id).single();
  if (!me?.is_active) return json(origin, 403, { error: "Your account is turned off.", kind: "invalid" });

  let body: { conversation_id?: string; message?: string; mode?: string; subject_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return json(origin, 400, { error: "The request was not readable.", kind: "invalid" });
  }
  const question = String(body.message ?? "").trim().slice(0, 4000);
  if (!question) return json(origin, 400, { error: "Please type a question.", kind: "invalid" });
  const mode = body.mode === "clinical" ? "clinical" : "tea";

  // 2. Daily limit (the admin isn't limited).
  const day = manilaDay();
  const { data: limitRow } = await db.from("app_settings").select("value").eq("key", "daily_answer_limit").maybeSingle();
  const limit = Number(limitRow?.value ?? 10) || 10;
  const { data: usage } = await db.from("ai_usage").select("answers").eq("student_id", me.id).eq("day", day).maybeSingle();
  const used = usage?.answers ?? 0;
  if (me.role !== "admin" && used >= limit) {
    return json(origin, 200, {
      kind: "limit",
      error: `You've used all ${limit} of today's AI Tutor answers. They reset at midnight (Philippine time). Your saved conversations, library and everything else still work.`,
      remaining: 0,
    });
  }
  if (!GROQ_KEY) return json(origin, 200, { kind: "unavailable", error: "The AI Tutor isn't set up yet. Please tell your administrator." });

  // 3. Conversation (own only).
  let conversation: { id: string; message_count: number; summary: string | null; subject_id: string | null; title: string } | null = null;
  if (body.conversation_id) {
    const { data } = await db
      .from("conversations")
      .select("id, message_count, summary, subject_id, title, student_id")
      .eq("id", body.conversation_id)
      .maybeSingle();
    if (!data || data.student_id !== me.id) return json(origin, 404, { error: "Conversation not found.", kind: "invalid" });
    conversation = data;
  }
  const subjectId = body.subject_id ?? conversation?.subject_id ?? null;
  let subjectName: string | null = null;
  if (subjectId) {
    const { data: s } = await db.from("subjects").select("code, title").eq("id", subjectId).maybeSingle();
    if (s) subjectName = `${s.code} – ${s.title}`;
  }

  // 4. Earlier messages in this conversation + study history from other sessions.
  const recent: ChatMessage[] = [];
  if (conversation) {
    const { data: msgs } = await db
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("id", { ascending: false })
      .limit(8);
    for (const m of (msgs ?? []).reverse()) recent.push({ role: m.role, content: String(m.content).slice(0, 3000) });
  }
  const { data: past } = await db
    .from("conversations")
    .select("id, title, summary, next_step, last_message_at")
    .eq("student_id", me.id)
    .not("summary", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(4);
  const history = (past ?? [])
    .map((c) => `- ${c.last_message_at.slice(0, 10)} "${c.title}"${c.id === conversation?.id ? " (this conversation)" : ""}: ${c.summary}${c.next_step ? ` Suggested next: ${c.next_step}` : ""}`)
    .join("\n");

  // 5. Search the shared library.
  let sources: Source[] = [];
  try {
    const searchText = recent.length ? `${recent.filter((m) => m.role === "user").slice(-1)[0]?.content ?? ""}\n${question}` : question;
    const embedding = await embedder.run(searchText.slice(0, 1500), { mean_pool: true, normalize: true });
    const { data: hits } = await db.rpc("search_library", {
      query_embedding: JSON.stringify(embedding),
      query_text: question.slice(0, 300),
      preferred_subject: subjectId,
      match_count: 6,
    });
    sources = ((hits ?? []) as { title: string; page_number: number | null; content: string; source_type: string; status: string; score: number; document_id: string }[])
      .filter((h) => h.score >= 0.85) // gte-small scores unrelated text around 0.80; relevant passages score higher
      .slice(0, 5)
      .map((h, i) => ({ n: i + 1, title: h.title, page: h.page_number, source_type: h.source_type, status: h.status, content: h.content, document_id: h.document_id }) as Source & { document_id: string });
  } catch (e) {
    console.error("library search failed", e);
  }

  // 6. Ask the AI.
  const safety = isSafetyTopic(question);
  const system = systemPrompt({
    mode,
    safety,
    studentName: (me.preferred_name || me.full_name || "").split(" ")[0],
    yearLevel: me.year_level ? YEAR[me.year_level] : "nursing student",
    subject: subjectName,
    history,
    sources,
  });
  const chat: ChatMessage[] = [{ role: "system", content: system }, ...recent, { role: "user", content: question }];

  let answer = "";
  let model = MAIN_MODEL;
  try {
    answer = await groq(MAIN_MODEL, chat, { maxTokens: 1800 });
  } catch (e) {
    console.error("main model failed", (e as { status?: number }).status, (e as { detail?: string }).detail);
    try {
      model = BACKUP_MODEL;
      answer = await groq(BACKUP_MODEL, chat, { maxTokens: 1600 });
    } catch (e2) {
      const status = (e2 as { status?: number }).status;
      console.error("backup model failed", status, (e2 as { detail?: string }).detail);
      return json(origin, 200, {
        kind: "unavailable",
        error:
          status === 429
            ? "Nurse Mira's free AI has reached its limit for now. Please try again in a little while. Your saved conversations and library still work."
            : "The AI Tutor can't be reached right now. Please try again in a few minutes. Your saved conversations and library still work.",
      });
    }
  }

  // Keep only the sources the answer actually cited.
  const cited = new Set([...answer.matchAll(/\[?\bS(\d{1,2})\b\]?/g)].map((m) => Number(m[1])));
  const usedSources = (sources as (Source & { document_id: string })[])
    .filter((s) => cited.has(s.n))
    .map((s) => ({ n: s.n, document_id: s.document_id, title: s.title, page: s.page, source_type: s.source_type, status: s.status }));
  // If library pages matched but the AI didn't cite them, still show the best ones — labelled "related", not as citations.
  const relatedSources =
    usedSources.length === 0
      ? (sources as (Source & { document_id: string })[])
          .slice(0, 2)
          .map((s) => ({ n: s.n, document_id: s.document_id, title: s.title, page: s.page, source_type: s.source_type, status: s.status, related: true }))
      : [];
  // Nothing in the library matched: make sure the student is told, even if the AI forgot to say so.
  if (sources.length === 0 && !/library/i.test(answer.slice(0, 300))) {
    answer = `_This topic isn't in the Nurse Mira library yet, so this answer is from general nursing knowledge._\n\n${answer}`;
  }

  // 7. Save.
  if (!conversation) {
    const title = question.replace(/\s+/g, " ").slice(0, 70) + (question.length > 70 ? "…" : "");
    const { data: created, error } = await db
      .from("conversations")
      .insert({ student_id: me.id, title, mode, subject_id: subjectId })
      .select("id, message_count, summary, subject_id, title")
      .single();
    if (error || !created) return json(origin, 500, { error: "Couldn't save the conversation.", kind: "invalid" });
    conversation = created;
  }
  const conv = conversation!;
  await db.from("messages").insert({ conversation_id: conv.id, role: "user", content: question, mode });
  const { data: saved } = await db
    .from("messages")
    .insert({ conversation_id: conv.id, role: "assistant", content: answer, sources: [...usedSources, ...relatedSources], mode, provider: "groq", model, safety_mode: safety })
    .select("id, role, content, sources, mode, safety_mode, created_at")
    .single();
  const newCount = conv.message_count + 2;
  await db.from("conversations").update({ message_count: newCount, last_message_at: new Date().toISOString(), mode, subject_id: subjectId }).eq("id", conv.id);
  await db.from("ai_usage").upsert({ student_id: me.id, day, answers: used + 1 });

  // 8. Every few answers, refresh the study summary (cheap, small model). Failures are ignored.
  if (newCount % 4 === 2) {
    try {
      const transcript = [...recent, { role: "user", content: question }, { role: "assistant", content: answer }]
        .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content.slice(0, 800)}`)
        .join("\n");
      const raw = await groq(BACKUP_MODEL, [{ role: "system", content: summaryPrompt() }, { role: "user", content: transcript }], { maxTokens: 300, json: true, temperature: 0.2 });
      const parsed = JSON.parse(raw);
      await db
        .from("conversations")
        .update({
          summary: String(parsed.summary ?? "").slice(0, 500) || null,
          next_step: String(parsed.next_step ?? "").slice(0, 200) || null,
          topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 4).map((t: unknown) => String(t).slice(0, 60)) : [],
        })
        .eq("id", conv.id);
    } catch (e) {
      console.error("summary failed", e);
    }
  }

  return json(origin, 200, {
    conversation_id: conv.id,
    message: saved,
    safety_mode: safety,
    remaining: me.role === "admin" ? null : Math.max(0, limit - used - 1),
  });
});
