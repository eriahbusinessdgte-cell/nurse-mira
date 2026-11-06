// Keeps the free Supabase project awake. Free projects pause after 7 days with no
// activity; Vercel calls this once a day (see vercel.json "crons"), and it makes one
// tiny database request. It reads nothing private and needs no sign-in.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export async function GET(request: Request) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when that variable is set.
  // Reading the request also keeps this route from being saved as a fixed page at build time.
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("ping");
  return NextResponse.json({ ok: !error && data === 1, at: new Date().toISOString() }, { status: error ? 503 : 200 });
}
