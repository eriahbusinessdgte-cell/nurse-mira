"use client";

import { createClient } from "@/lib/supabase/client";

// Calls the admin-users Edge Function (runs inside Supabase with the secret key).
type Result<T> = { data: T; error: null } | { data: null; error: string };

export async function adminUsers<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<Result<T>> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { ...body, origin: window.location.origin },
  });
  if (error) {
    // The function sends friendly messages as { error: "…" }.
    let message = "Something went wrong. Please try again.";
    try {
      const ctx = (error as { context?: Response }).context;
      const parsed = ctx ? await ctx.json() : null;
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep the default message */
    }
    return { data: null, error: message };
  }
  return { data: data as T, error: null };
}
