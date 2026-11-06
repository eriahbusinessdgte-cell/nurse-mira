// Nurse Mira — read one photographed page (handwriting or print) with Cloudflare's free vision AI.
//
// POST { image: "<base64 JPEG>" }  ->  { text, readable }  or  { error, kind: "budget" | "unavailable" | "invalid" }
//
// The browser sends one page at a time while a student uploads (or re-reads) a reviewer.
// Cloudflare's free allowance is 10,000 "neurons" a day (resets 00:00 UTC). Reading pages may use
// up to the page-reading budget (Settings, default 6,500) of it so the AI Tutor backup always keeps some.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim() ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim() ?? "";

const MODELS = ["@cf/mistralai/mistral-small-3.1-24b-instruct", "@cf/meta/llama-4-scout-17b-16e-instruct"];
const DEFAULT_PAGE_BUDGET = 6500; // neurons per day for reading pages (about 80 pages); admin can change it in Settings
const MAX_IMAGE_CHARS = 3_000_000; // ~2.2 MB JPEG

const PROMPT = `This is a photo or scan of a page of nursing study notes (handwritten or printed).
Transcribe ALL the writing on the page exactly as written, line by line, keeping headings, lists and tables.
Do not add, explain, summarise or correct anything, and do not describe the picture.
If a word is unreadable write [?]. If the page has no writing at all, reply only: NO_TEXT`;

const ALLOWED = ["https://nurse-mira.vercel.app", "http://localhost:3000"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (origin: string | null, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

const utcDay = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(origin, 405, { error: "Method not allowed.", kind: "invalid" });

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return json(origin, 401, { error: "Please sign in again.", kind: "invalid" });
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await db.from("profiles").select("is_active").eq("id", who.user.id).single();
  if (!me?.is_active) return json(origin, 403, { error: "Your account is turned off.", kind: "invalid" });

  if (!CF_ACCOUNT || !CF_TOKEN) return json(origin, 200, { kind: "unavailable", error: "Handwriting reading isn't set up." });

  let image = "";
  try {
    image = String((await req.json())?.image ?? "");
  } catch {
    return json(origin, 400, { error: "The request was not readable.", kind: "invalid" });
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)) || image.length < 1000) return json(origin, 400, { error: "No page picture was sent.", kind: "invalid" });
  if (image.length > MAX_IMAGE_CHARS) return json(origin, 400, { error: "The page picture is too large.", kind: "invalid" });

  // Free allowance check (pages share Cloudflare's daily allowance with the tutor backup).
  const [{ data: usage }, { data: budgetRow }] = await Promise.all([
    db.from("cloudflare_usage").select("neurons").eq("day", utcDay()).maybeSingle(),
    db.from("app_settings").select("value").eq("key", "page_reading_budget").maybeSingle(),
  ]);
  const setBudget = Number(budgetRow?.value);
  const pageBudget = Number.isFinite(setBudget) ? Math.min(9500, Math.max(0, setBudget)) : DEFAULT_PAGE_BUDGET;
  if (Number(usage?.neurons ?? 0) >= pageBudget) {
    return json(origin, 200, {
      kind: "budget",
      error: "Today's free handwriting reading is used up. It resets at 8:00 AM Philippine time — you can press \"Read again\" on the document then.",
    });
  }

  const url = `data:image/jpeg;base64,${image}`;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url } }] }],
          max_tokens: 1500,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        console.error("vision failed", model, res.status, JSON.stringify(body?.errors ?? "").slice(0, 300));
        continue;
      }
      const neurons = Number(body.result?.usage?.neurons ?? 80);
      await db.rpc("add_cloudflare_usage", { p_neurons: neurons, p_kind: "page" });
      let text = String(body.result?.response ?? "").trim();
      text = text.replace(/^(here is|here's) the transcription[^\n]*\n+/i, "").trim();
      if (/^NO_TEXT\.?$/i.test(text)) return json(origin, 200, { text: "", readable: false, empty: true });
      const unknown = (text.match(/\[\?\]/g) ?? []).length;
      const words = text.split(/\s+/).filter(Boolean).length;
      const readable = text.length >= 40 && unknown <= Math.max(3, words * 0.15);
      return json(origin, 200, { text, readable });
    } catch (e) {
      console.error("vision error", model, (e as Error).name);
    }
  }
  return json(origin, 200, { kind: "unavailable", error: "The page reader can't be reached right now. Please try again later." });
});
