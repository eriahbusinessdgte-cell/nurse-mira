// Tells the admin's Problems list that something went wrong. Never sends what the
// student typed or read — only which tool, what kind of problem and the app's own message.
import { createClient } from "@/lib/supabase/client";

export type ProblemTool = "tutor" | "review" | "quiz" | "case-draft" | "ncp" | "drug-study" | "read-page" | "embed" | "page";

export function problemKind(data: unknown, failed: boolean): string {
  const k = (data as { kind?: unknown } | null)?.kind;
  if (typeof k === "string" && /^[a-z_-]{2,20}$/.test(k)) return k;
  return failed && !data ? "unreachable" : "error";
}

export function reportProblem(tool: ProblemTool, kind: string, message?: string) {
  try {
    const path = typeof window === "undefined" ? "" : window.location.pathname;
    void createClient()
      .rpc("log_app_event", { p_tool: tool, p_kind: kind, p_message: (message ?? "").slice(0, 300), p_path: path })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* reporting must never break the page */
  }
}
