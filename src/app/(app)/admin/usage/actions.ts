"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";

export async function clearProblems() {
  const { supabase } = await requireProfile("admin");
  await supabase.from("app_events").delete().gte("id", 0);
  revalidatePath("/admin/usage");
}
