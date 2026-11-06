// Nurse Mira — admin user tools (runs inside Supabase).
// The Supabase secret key is provided to this function automatically, so it is
// never copied anywhere by hand. Every request must come from a signed-in,
// active administrator.
//
// Actions:
//   invite      { email, full_name, year_level?, current_semester?, origin }
//   setup_link  { user_id, origin }            -> new one-time link (setup or reset)
//   set_active  { user_id, active }            -> turn an account off / on
//   delete      { user_id, confirm_email }     -> permanently delete a student
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = [
  "https://nurse-mira.vercel.app",
  "http://localhost:3000",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
];

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const reply = (origin: string | null, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

const fail = (origin: string | null, status: number, message: string) => reply(origin, status, { error: message });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return fail(origin, 405, "Method not allowed.");

  // 1. Who is calling?
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return fail(origin, 401, "Please sign in again.");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role, is_active").eq("id", who.user.id).single();
  if (!me || me.role !== "admin" || !me.is_active) return fail(origin, 403, "Only the administrator can do this.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(origin, 400, "The request was not readable.");
  }

  const log = (action: string, target_id: string | null, details: Record<string, unknown> = {}) =>
    admin.from("activity_log").insert({ actor_id: who.user.id, action, target_id, details });

  const linkFor = async (email: string, linkOrigin: string) => {
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !data?.properties?.hashed_token) throw new Error(error?.message ?? "Could not create the link.");
    const url = new URL("/auth/confirm", linkOrigin);
    url.searchParams.set("token_hash", data.properties.hashed_token);
    url.searchParams.set("type", "recovery");
    return url.toString();
  };

  const pickOrigin = (value: unknown) =>
    typeof value === "string" && ALLOWED_ORIGINS.includes(value) ? value : ALLOWED_ORIGINS[0];

  try {
    switch (body.action) {
      case "invite": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const fullName = String(body.full_name ?? "").trim();
        if (!EMAIL_RE.test(email)) return fail(origin, 400, "Please enter a valid email address.");
        if (!fullName) return fail(origin, 400, "Please enter the student's name.");

        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          app_metadata: { nm_invited: "true" },
          user_metadata: { full_name: fullName },
        });
        if (error) {
          const msg = error.message.toLowerCase().includes("already")
            ? "A Nurse Mira account already uses this email. Find the student in the list and create a new setup link instead."
            : `Could not create the account: ${error.message}`;
          return fail(origin, 400, msg);
        }
        const id = created.user.id;
        const year = Number(body.year_level);
        const sem = Number(body.current_semester);
        await admin
          .from("profiles")
          .update({
            year_level: year >= 1 && year <= 4 ? year : null,
            current_semester: sem >= 1 && sem <= 2 ? sem : null,
          })
          .eq("id", id);
        const link = await linkFor(email, pickOrigin(body.origin));
        await log("student.invited", id, { email });
        return reply(origin, 200, { user_id: id, link });
      }

      case "setup_link": {
        const id = String(body.user_id ?? "");
        const { data: p } = await admin.from("profiles").select("email, role").eq("id", id).single();
        if (!p) return fail(origin, 404, "Student not found.");
        const link = await linkFor(p.email, pickOrigin(body.origin));
        await log("student.setup_link", id);
        return reply(origin, 200, { link });
      }

      case "set_active": {
        const id = String(body.user_id ?? "");
        const active = body.active === true;
        const { data: p } = await admin.from("profiles").select("role").eq("id", id).single();
        if (!p) return fail(origin, 404, "Student not found.");
        if (p.role === "admin") return fail(origin, 400, "Administrator accounts can't be turned off here.");
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
        if (error) return fail(origin, 400, `Could not update sign-in access: ${error.message}`);
        await admin.from("profiles").update({ is_active: active }).eq("id", id);
        await log(active ? "student.reactivated" : "student.deactivated", id);
        return reply(origin, 200, { ok: true, active });
      }

      case "delete": {
        // Permanent. The admin must retype the student's email to confirm.
        const id = String(body.user_id ?? "");
        const confirmEmail = String(body.confirm_email ?? "").trim().toLowerCase();
        const { data: p } = await admin.from("profiles").select("email, role").eq("id", id).single();
        if (!p) return fail(origin, 404, "Student not found.");
        if (p.role === "admin") return fail(origin, 400, "Administrator accounts can't be deleted here.");
        if (confirmEmail !== p.email.toLowerCase()) return fail(origin, 400, "The email you typed doesn't match this student.");
        // Deleting the login removes the profile and everything linked to it (database cascade).
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) return fail(origin, 400, `Could not delete the account: ${error.message}`);
        await log("student.deleted", null, { email: p.email });
        return reply(origin, 200, { ok: true });
      }

      default:
        return fail(origin, 400, "Unknown action.");
    }
  } catch (e) {
    console.error(e);
    return fail(origin, 500, "Something went wrong. Please try again.");
  }
});
