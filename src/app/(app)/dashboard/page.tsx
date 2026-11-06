import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, CalendarDays, Coffee, MessageCircleHeart, Sparkles, Stethoscope } from "lucide-react";
import { Greeting } from "@/components/greeting";
import { MiniCalendar } from "@/components/mini-calendar";
import { PageLoading } from "@/components/page-loading";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import type { Subject } from "@/lib/curriculum";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireStudent } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Nurse Mira" };

const CARD_TINTS = ["bg-mira-blue-soft text-mira-blue", "bg-amber-50 text-amber-700", "bg-rose-50 text-rose-600", "bg-emerald-50 text-emerald-700"];

async function Dashboard() {
  const { supabase, profile } = await requireStudent();
  const { data } = await supabase
    .from("student_subjects")
    .select("subjects(id, code, title, year_level, semester, sort_order)")
    .eq("student_id", profile.id);
  const subjects = ((data ?? []) as unknown as { subjects: Subject & { sort_order: number } }[])
    .map((r) => r.subjects)
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);

  const { data: convData } = await supabase
    .from("conversations")
    .select("id, title, mode, summary, next_step, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(4);
  const sessions = (convData ?? []) as { id: string; title: string; mode: "tea" | "clinical"; summary: string | null; next_step: string | null; last_message_at: string }[];
  const latest = sessions[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        {/* Greeting card */}
        <Card className="relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-mira-blue-soft" aria-hidden />
          <div className="absolute -bottom-12 right-20 h-28 w-28 rounded-full bg-mira-yellow/25" aria-hidden />
          <div className="relative">
            <Greeting person={profile} className="text-2xl font-semibold" />
            <p className="mt-2 max-w-lg text-mira-muted">
              {profile.year_level && profile.current_semester
                ? `${YEAR_LABEL[profile.year_level]} · ${SEM_LABEL[profile.current_semester]} · ${subjects.length} subject${subjects.length === 1 ? "" : "s"}. `
                : ""}
              {latest ? "Ready to pick up where you left off?" : "Ask Nurse Mira anything about your subjects to start your first study session."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {latest ? (
                <ButtonLink href={`/tutor?c=${latest.id}&ask=${encodeURIComponent("Where did we leave off?")}`} kind="accent">
                  <ArrowRight size={18} aria-hidden /> Continue Studying
                </ButtonLink>
              ) : (
                <ButtonLink href="/tutor" kind="accent">
                  <MessageCircleHeart size={18} aria-hidden /> Start studying with Nurse Mira
                </ButtonLink>
              )}
              <ButtonLink href="/subjects" kind="secondary">
                <BookOpen size={18} aria-hidden /> My subjects
              </ButtonLink>
            </div>
          </div>
        </Card>

        {/* Subjects */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Subjects</h2>
            <Link href="/subjects" className="text-sm text-mira-blue hover:underline">
              Manage
            </Link>
          </div>
          {subjects.length === 0 ? (
            <EmptyState title="No subjects yet" action={<ButtonLink href="/subjects">Choose subjects</ButtonLink>}>
              Pick the subjects you&apos;re taking this semester so Nurse Mira can focus on them.
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {subjects.map((s, i) => (
                <Card key={s.id} className="!p-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${CARD_TINTS[i % CARD_TINTS.length]}`}>
                      {s.code.replace(/[^0-9]/g, "") || s.code.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{s.code}</p>
                      <p className="line-clamp-2 text-sm text-mira-muted">{s.title}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent study sessions */}
        {sessions.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Study Sessions</h2>
              <Link href="/tutor" className="text-sm text-mira-blue hover:underline">
                New session
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.map((c) => (
                <Link key={c.id} href={`/tutor?c=${c.id}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mira-line hover:ring-mira-blue">
                  <p className="flex items-center gap-1.5 text-xs text-mira-muted">
                    {c.mode === "tea" ? <Coffee size={13} aria-hidden /> : <Stethoscope size={13} aria-hidden />}
                    {c.mode === "tea" ? "Tea Mode" : "Clinical"} ·{" "}
                    {new Date(c.last_message_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })}
                  </p>
                  <p className="mt-1 line-clamp-1 font-semibold">{c.title}</p>
                  {c.summary && <p className="mt-1 line-clamp-2 text-sm text-mira-muted">{c.summary}</p>}
                  {c.next_step && <p className="mt-2 line-clamp-1 text-xs font-medium text-mira-blue">Next: {c.next_step}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Coming next */}
        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/tutor" className="rounded-2xl bg-mira-yellow p-5 text-mira-blue-dark">
            <MessageCircleHeart size={28} aria-hidden />
            <p className="mt-3 text-lg font-semibold">AI Tutor</p>
            <p className="text-sm opacity-80">Tea Mode and Clinical Mode explanations, with sources from the shared library.</p>
          </Link>
          <Link href="/review" className="rounded-2xl bg-mira-blue p-5 text-white">
            <Sparkles size={28} aria-hidden />
            <p className="mt-3 text-lg font-semibold">Review Center</p>
            <p className="text-sm opacity-80">Study sheets with summaries, flashcards and practice questions from the shared library.</p>
          </Link>
        </section>
      </div>

      {/* Right column */}
      <aside className="space-y-6">
        <Card>
          <MiniCalendar />
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <CalendarDays size={18} className="text-mira-blue" aria-hidden /> Your Tasks Today
          </h2>
          <EmptyState title="Nothing due today">Assignments, exams and clinical requirements will show here when My Planner opens.</EmptyState>
        </Card>
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading your dashboard…" />}>
      <Dashboard />
    </Suspense>
  );
}
