"use server";

import { revalidatePath } from "next/cache";
import { checkSettings, readSettings } from "@/lib/settings";
import { requireProfile } from "@/lib/supabase/server";

export type SaveResult = { ok: boolean; message: string };

export async function saveSettings(input: Record<string, unknown>): Promise<SaveResult> {
  const { supabase, profile } = await requireProfile("admin");
  const checked = checkSettings(input);
  if (!checked.ok) return checked;

  const { data: before } = await supabase.from("app_settings").select("key, value");
  const old = readSettings(before);
  const changed = (Object.keys(checked.settings) as (keyof typeof checked.settings)[]).filter((k) => old[k] !== checked.settings[k]);
  if (!changed.length) return { ok: true, message: "Nothing changed." };

  for (const key of changed) {
    const { error, count } = await supabase.from("app_settings").update({ value: checked.settings[key] }, { count: "exact" }).eq("key", key);
    if (error || !count) return { ok: false, message: "Couldn't save the settings. Please try again." };
  }
  await supabase.from("activity_log").insert({
    actor_id: profile.id,
    action: "settings.updated",
    details: Object.fromEntries(changed.map((k) => [k, { from: old[k], to: checked.settings[k] }])),
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/tutor");
  return { ok: true, message: "Saved. The new settings apply right away." };
}
