"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/supabase/server";

export async function deleteConversation(id: string): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireStudent();
  const { error, count } = await supabase.from("conversations").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, message: "Couldn't delete the conversation." };
  revalidatePath("/tutor");
  revalidatePath("/dashboard");
  return { ok: true, message: "Conversation deleted." };
}

export async function renameConversation(id: string, title: string): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireStudent();
  const clean = title.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!clean) return { ok: false, message: "Please enter a title." };
  const { error } = await supabase.from("conversations").update({ title: clean }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't rename the conversation." };
  revalidatePath("/tutor");
  return { ok: true, message: "Renamed." };
}

/** Keep a chat (never auto-deleted) or let it expire 30 days after its last message. */
export async function setKept(id: string, kept: boolean): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireStudent();
  const { error, count } = await supabase.from("conversations").update({ kept }, { count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, message: "Couldn't update the conversation." };
  revalidatePath("/tutor");
  return { ok: true, message: kept ? "Kept — it won't be deleted." : "It will be deleted 30 days after its last message." };
}
