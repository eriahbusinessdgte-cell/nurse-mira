// Nurse Mira — generate nursing care plans (NCPs) from the student's own assessment data.
//
// POST { case_id?, assessment_text?, count (1-10), focus?: string }
//  -> { created: number, ids: [...], remaining }  or  { error, kind }
//
// Plans are saved (private to the student) and can then be edited, duplicated, reordered and exported.
// The AI must never invent assessment data: cues come only from what the student supplied;
// anything else is listed separately as "to assess".
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim() ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim() ?? "";
const MAIN_MODEL = "openai/gpt-oss-120b";
const BACKUP_MODEL = "openai/gpt-oss-20b";
const CF_MODEL = "@cf/openai/gpt-oss-120b";
const CF_DAILY_LIMIT = 9700;

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

const LABELS: Record<string, string> = {
  profile: "Patient profile",
  diagnosis: "Medical diagnosis / impression",
  complaint: "Chief complaint and history of present illness",
  history: "Past medical, family and obstetric history",
  assessment: "Vital signs and nursing assessment findings",
  diagnostics: "Laboratory and diagnostic results",
  medical: "Medical management",
  surgical: "Surgical management",
  supportive: "Supportive care",
  notes: "Other notes",
};
const BLOCK: [RegExp, string][] = [
  [/(\+63|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/, "a phone number"],
  [/\b(patient'?s?\s+name|full\s*name|pangalan)\s*[:\-]/i, "a patient name field"],
  [/\b(hospital|case|record|chart)\s*(no\.?|number|#)\s*[:#]?\s*[A-Z0-9-]{3,}/i, "a hospital or record number"],
  [/\b(MRN|PhilHealth|SSS|GSIS)\b\s*[:#]?\s*[0-9][0-9 -]{4,}/i, "an ID number"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "an email address"],
  [/\b(Mr|Mrs|Ms|Miss)\.?\s+[A-Z][a-z]{2,}/, "a name with a title"],
];

type Msg = { role: "system" | "user"; content: string };
async function groq(model: string, messages: Msg[], maxTokens: number) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_completion_tokens: maxTokens, reasoning_effort: "low", response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Groq ${res.status}`), { status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) });
  return String((await res.json())?.choices?.[0]?.message?.content ?? "");
}
// deno-lint-ignore no-explicit-any
async function cloudflare(db: any, messages: Msg[], maxTokens: number) {
  if (!CF_ACCOUNT || !CF_TOKEN) throw Object.assign(new Error("Cloudflare not set up"), { status: 503 });
  const { data: usage } = await db.from("cloudflare_usage").select("neurons").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
  if (Number(usage?.neurons ?? 0) >= CF_DAILY_LIMIT) throw Object.assign(new Error("Cloudflare allowance used"), { status: 429 });
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: CF_MODEL, messages, max_tokens: maxTokens, temperature: 0.2, reasoning_effort: "low", response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Cloudflare ${res.status}`), { status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) });
  const data = await res.json();
  await db.rpc("add_cloudflare_usage", { p_neurons: Number(data?.usage?.neurons ?? 600), p_kind: "answer" });
  return String(data?.choices?.[0]?.message?.content ?? "");
}

const str = (v: unknown, max = 1200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, n: number, max = 400) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
// deno-lint-ignore no-explicit-any
function cleanPlan(p: any) {
  const plan = {
    diagnosis: str(p?.diagnosis, 400),
    assessment: { subjective: strs(p?.assessment?.subjective, 10), objective: strs(p?.assessment?.objective, 14) },
    to_assess: strs(p?.to_assess, 8),
    outcomes: { short_term: strs(p?.outcomes?.short_term, 5), long_term: strs(p?.outcomes?.long_term, 4) },
    planning: str(p?.planning, 1500),
    interventions: (Array.isArray(p?.interventions) ? p.interventions : [])
      // deno-lint-ignore no-explicit-any
      .map((i: any) => ({ action: str(i?.action, 500), rationale: str(i?.rationale, 700), kind: ["independent", "dependent", "collaborative"].includes(i?.kind) ? i.kind : "independent" }))
      .filter((i: { action: string }) => i.action)
      .slice(0, 14),
    evaluation: str(p?.evaluation, 1200),
  };
  return plan.diagnosis && plan.interventions.length >= 3 ? plan : null;
}

const SYSTEM = `You help a Filipino BSN nursing student write Nursing Care Plans (NCPs) using the nursing process.
Structure of each plan: Assessment (subjective and objective cues) → Nursing Diagnosis → Outcomes → Planning → Nursing Interventions with Rationale → Evaluation.

ABSOLUTE RULES
- Assessment cues must come ONLY from the student's data. Quote or closely paraphrase them; never invent vital signs, lab values, statements or observations. If there are no subjective cues, leave that list empty.
- Put findings that would support the diagnosis but were NOT supplied in "to_assess" (things the student should check), never in the assessment.
- Diagnoses: NANDA-I style. Actual: "<problem> related to <etiology> as evidenced by <supplied cues>". Risk: "Risk for <problem> as evidenced by / related to <risk factors from the data>". Prioritise (ABC, Maslow, safety) and don't duplicate diagnoses.
- Outcomes are SMART and patient-centred (short-term within the shift/24–72 h; long-term by discharge).
- Interventions: specific nursing actions, each with a concise evidence-based rationale, labelled "independent", "dependent" (needs a physician's order) or "collaborative". Include assessment/monitoring, therapeutic and teaching actions. No drug doses unless supplied; write "as ordered".
- Evaluation: state the criteria that would show the goal was met/partially met/not met; do not claim results that did not happen.
- No names. This is a learning aid; it does not replace the clinical instructor.

Reply ONLY with JSON:
{"plans": [{"diagnosis": "...", "assessment": {"subjective": ["..."], "objective": ["..."]}, "to_assess": ["..."], "outcomes": {"short_term": ["..."], "long_term": ["..."]}, "planning": "...", "interventions": [{"action": "...", "rationale": "...", "kind": "independent|dependent|collaborative"}], "evaluation": "..."}]}`;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(origin, 405, { error: "Method not allowed.", kind: "invalid" });

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return json(origin, 401, { error: "Please sign in again.", kind: "invalid" });
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await db.from("profiles").select("id, role, is_active").eq("id", who.user.id).single();
  if (!me?.is_active) return json(origin, 403, { error: "Your account is turned off.", kind: "invalid" });

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(origin, 400, { error: "The request was not readable.", kind: "invalid" });
  }
  const count = Math.min(10, Math.max(1, Math.round(Number(body.count) || 3)));
  const focus = str(body.focus, 600);

  // Patient data: from a linked case study, or typed in directly.
  let caseId: string | null = null;
  let data = "";
  if (body.case_id) {
    const { data: cs } = await db.from("case_studies").select("id, student_id, facts, deidentified_confirmed").eq("id", String(body.case_id)).maybeSingle();
    if (!cs || cs.student_id !== me.id) return json(origin, 404, { error: "Case study not found.", kind: "invalid" });
    if (!cs.deidentified_confirmed) return json(origin, 400, { error: "Open the case study and confirm its information is de-identified first.", kind: "invalid" });
    caseId = cs.id;
    const facts = (cs.facts ?? {}) as Record<string, string>;
    data = Object.entries(LABELS).map(([k, l]) => (String(facts[k] ?? "").trim() ? `${l}:\n${String(facts[k]).trim().slice(0, 2500)}` : "")).filter(Boolean).join("\n\n");
  } else {
    data = str(body.assessment_text, 8000);
  }
  if (data.length < 30) return json(origin, 400, { error: "Please give the patient's assessment data first (what you observed and measured).", kind: "invalid" });
  for (const [re, what] of BLOCK) if (re.test(data)) return json(origin, 400, { error: `The patient data seems to contain ${what}. Please remove it first.`, kind: "invalid" });

  const day = manilaDay();
  const { data: limitValue } = await db.rpc("student_daily_limit");
  const limit = Number(limitValue ?? 10) || 10;
  const { data: usage } = await db.from("ai_usage").select("answers").eq("student_id", me.id).eq("day", day).maybeSingle();
  const used = usage?.answers ?? 0;
  if (me.role !== "admin" && used >= limit) {
    return json(origin, 200, { kind: "limit", error: `Generating NCPs uses one AI answer, and you've used all ${limit} for today. You can still write and edit plans yourself. Answers reset at midnight.` });
  }

  const user = `PATIENT DATA (de-identified, supplied by the student)
${data}

Write exactly ${count} nursing care plan${count === 1 ? "" : "s"}, in priority order.${focus ? `\nThe student wants these diagnoses/problems included if the data supports them: ${focus}` : ""}`;
  const messages: Msg[] = [{ role: "system", content: SYSTEM }, { role: "user", content: user }];
  const maxTokens = Math.min(7000, 600 + count * 700);
  const attempts = [
    { run: () => groq(MAIN_MODEL, messages, maxTokens) },
    { run: () => cloudflare(db, messages, maxTokens) },
    { run: () => groq(BACKUP_MODEL, messages, maxTokens) },
  ];
  // deno-lint-ignore no-explicit-any
  let plans: any[] = [];
  let lastStatus: number | undefined;
  for (const a of attempts) {
    try {
      const parsed = JSON.parse(await a.run());
      plans = (Array.isArray(parsed?.plans) ? parsed.plans : []).slice(0, count).map(cleanPlan).filter(Boolean);
      if (plans.length >= Math.max(1, Math.ceil(count * 0.6))) break;
      throw Object.assign(new Error(`Only ${plans.length} plans`), { status: 502 });
    } catch (e) {
      lastStatus = (e as { status?: number }).status;
      console.error("ncp generation failed", lastStatus, (e as { detail?: string }).detail ?? (e as Error).message);
      plans = [];
    }
  }
  if (!plans.length) {
    return json(origin, 200, {
      kind: "unavailable",
      error: lastStatus === 429 ? "Nurse Mira's free AI is busy right now. Please try again in a little while." : "The care plans couldn't be made right now. Please try again in a few minutes.",
    });
  }

  // Add after the student's existing plans for the same case.
  let q = db.from("care_plans").select("position").eq("student_id", me.id).order("position", { ascending: false }).limit(1);
  q = caseId ? q.eq("case_study_id", caseId) : q.is("case_study_id", null);
  const { data: last } = await q;
  const start = (last?.[0]?.position ?? -1) + 1;
  const { data: rows, error } = await db
    .from("care_plans")
    .insert(plans.map((plan, i) => ({ student_id: me.id, case_study_id: caseId, position: start + i, plan, ai_generated: true })))
    .select("id");
  if (error) return json(origin, 500, { error: "The care plans couldn't be saved. Please try again.", kind: "invalid" });
  await db.from("ai_usage").upsert({ student_id: me.id, day, answers: used + 1 });
  return json(origin, 200, { created: plans.length, ids: (rows ?? []).map((r) => r.id), remaining: me.role === "admin" ? null : Math.max(0, limit - used - 1) });
});
