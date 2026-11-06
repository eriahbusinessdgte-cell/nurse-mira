import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { manilaDay, utcDay, withinDays } from "@/lib/dates";
import { readSettings, shareFor } from "@/lib/settings";
import { requireProfile } from "@/lib/supabase/server";
import { KIND_LABEL, TOOL_LABEL, dailyRows, isExpected, providerTotals, type ProviderCount } from "@/lib/usage";
import { ClearProblems } from "./clear-problems";

export const metadata = { title: "AI & Problems · Nurse Mira" };

const DAYS = 14;

function dayLabel(day: string) {
  return new Date(`${day}T12:00:00+08:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" });
}
function when(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

type Problem = { id: number; created_at: string; tool: string; kind: string; message: string; path: string; who: { full_name: string; role: string } | null };

async function Usage() {
  const { supabase } = await requireProfile("admin");
  const days = Array.from({ length: DAYS }, (_, i) => manilaDay(i));
  const since = days[days.length - 1];
  const utcSince = utcDay(DAYS);

  const [usage, cf, providers, problems, settings, active] = await Promise.all([
    supabase.from("ai_usage").select("day, student_id, answers").gte("day", since),
    supabase.from("cloudflare_usage").select("day, neurons, pages").gte("day", utcSince),
    supabase.rpc("ai_provider_counts", { p_days: DAYS }),
    supabase
      .from("app_events")
      .select("id, created_at, tool, kind, message, path, who:profiles!app_events_actor_id_fkey(full_name, role)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("app_settings").select("key, value"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("is_active", true),
  ]);

  const provider = ((providers.data ?? []) as ProviderCount[]).map((p) => ({ ...p, answers: Number(p.answers) }));
  // Cloudflare counts by UTC day (it resets at 8 AM Philippine time); shown against the same date.
  const rows = dailyRows(days, usage.data ?? [], (cf.data ?? []) as { day: string; neurons: number; pages: number }[], provider);
  const totals = providerTotals(provider);
  const s = readSettings(settings.data);
  const share = shareFor(s.daily_answer_pool, s.daily_answer_minimum, active.count ?? 0);
  const list = (problems.data ?? []) as unknown as Problem[];
  const broken = list.filter((p) => !isExpected(p.kind) && withinDays(p.created_at, 7)).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-mira-muted">AI answers, last {DAYS} days</p>
          <p className="mt-1 text-3xl font-semibold">{rows.reduce((n, r) => n + r.answers, 0)}</p>
          <p className="text-xs text-mira-muted">Today each student can use {share}.</p>
        </Card>
        <Card>
          <p className="text-sm text-mira-muted">Handwritten pages read, last {DAYS} days</p>
          <p className="mt-1 text-3xl font-semibold">{rows.reduce((n, r) => n + r.pages, 0)}</p>
          <p className="text-xs text-mira-muted">Allowance: {s.page_reading_budget.toLocaleString()} units a day.</p>
        </Card>
        <Card>
          <p className="text-sm text-mira-muted">Problems, last 7 days</p>
          <p className={`mt-1 text-3xl font-semibold ${broken ? "text-mira-danger" : ""}`}>{broken}</p>
          <p className="text-xs text-mira-muted">Not counting students reaching their daily answers.</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Day by day</h2>
        <p className="mt-1 text-sm text-mira-muted">Counts only — what students asked stays private.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-mira-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Day</th>
                <th className="py-1.5 pr-3 text-right font-medium">AI answers</th>
                <th className="py-1.5 pr-3 text-right font-medium">Students</th>
                <th className="py-1.5 pr-3 text-right font-medium">Tutor backups used</th>
                <th className="py-1.5 pr-3 text-right font-medium">Pages read</th>
                <th className="py-1.5 text-right font-medium">Cloudflare units</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} className={`border-t border-mira-line ${r.answers || r.units ? "" : "text-mira-muted"}`}>
                  <td className="py-1.5 pr-3">{dayLabel(r.day)}</td>
                  <td className="py-1.5 pr-3 text-right">{r.answers}</td>
                  <td className="py-1.5 pr-3 text-right">{r.students}</td>
                  <td className="py-1.5 pr-3 text-right">{r.backup}</td>
                  <td className="py-1.5 pr-3 text-right">{r.pages}</td>
                  <td className={`py-1.5 text-right ${r.units >= 9000 ? "font-semibold text-amber-700" : ""}`}>{r.units.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-mira-muted">
          Which AI answered tutor questions:{" "}
          {totals.length ? totals.map((t) => `${t.label} ${t.answers}`).join(" · ") : "no tutor answers yet"}. Backups take over automatically when Groq is
          busy; many backups on one day means Groq&apos;s free allowance ran out.
        </p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Problems</h2>
          {list.length > 0 && <ClearProblems />}
        </div>
        <p className="mt-1 text-sm text-mira-muted">
          The last 50 things that went wrong for anyone (kept 60 days). Only the kind of problem is recorded, never what was typed.
        </p>
        {list.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No problems recorded">When an AI tool fails or a page breaks, it will be listed here.</EmptyState>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-mira-line text-sm">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p>
                    <Badge tone={isExpected(p.kind) ? "gray" : p.kind === "crash" ? "red" : "yellow"}>{KIND_LABEL[p.kind] ?? p.kind}</Badge>{" "}
                    <span className="font-medium">{TOOL_LABEL[p.tool] ?? p.tool}</span>
                    <span className="text-mira-muted"> · {p.who?.full_name ?? "Someone"}{p.path ? ` · ${p.path}` : ""}</span>
                  </p>
                  {p.message && <p className="mt-0.5 break-words text-mira-muted">{p.message}</p>}
                </div>
                <span className="shrink-0 text-mira-muted">{when(p.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function UsagePage() {
  return (
    <>
      <PageHeader title="AI & Problems" description="How much of the free AI allowance is being used, and anything that went wrong." />
      <Suspense fallback={<PageLoading />}>
        <Usage />
      </Suspense>
    </>
  );
}
