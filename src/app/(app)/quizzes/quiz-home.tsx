"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Loader2,
  Play,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { weakTopics } from "@/lib/quiz/grade";
import { deleteQuiz } from "./actions";

export type QuizRow = {
  id: string;
  title: string;
  subject_id: string | null;
  focus: string | null;
  kind: "quiz" | "exam";
  time_limit_minutes: number | null;
  origin: "ai" | "review";
  created_at: string;
  count: number;
};
export type AttemptRow = {
  id: string;
  quiz_id: string;
  score: number;
  total: number;
  by_topic: Record<string, { right: number; total: number }>;
  finished_at: string;
};

type Props = {
  quizzes: QuizRow[];
  attempts: AttemptRow[];
  subjects: { id: string; code: string; title: string; sort_order: number }[];
  mySubjectIds: string[];
  sheets: { subject_id: string; focus: string }[];
  remaining: number;
};

const TYPE_CHOICES = [
  ["mcq", "Multiple choice"],
  ["scenario", "Situational (case-based)"],
  ["multi", "Select all that apply"],
  ["tf", "True or false"],
  ["identification", "Identification"],
] as const;

const pct = (s: number, t: number) => (t ? Math.round((s / t) * 100) : 0);
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

export function QuizHome({
  quizzes,
  attempts,
  subjects,
  mySubjectIds,
  sheets,
  remaining,
}: Props) {
  const router = useRouter();
  const sortedSubjects = [...subjects].sort(
    (a, b) =>
      Number(mySubjectIds.includes(b.id)) -
        Number(mySubjectIds.includes(a.id)) || a.sort_order - b.sort_order,
  );
  const [subjectId, setSubjectId] = useState(
    sortedSubjects.find((s) => mySubjectIds.includes(s.id))?.id ?? "",
  );
  const [focus, setFocus] = useState("");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(["mcq", "scenario", "tf"]);
  const [kind, setKind] = useState<"quiz" | "exam">("quiz");
  const [minutes, setMinutes] = useState(15);
  const [source, setSource] = useState<"ai" | "review">("ai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState(quizzes);
  const [, startTransition] = useTransition();

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );
  const savedForSubject = sheets.filter((s) => s.subject_id === subjectId);
  // Saved questions only work when the subject has Review Center sheets.
  const canUseSaved = savedForSubject.length > 0;
  const effectiveSource = canUseSaved ? source : "ai";
  const weak = weakTopics(attempts);
  const bySubject = useMemo(() => {
    const quizSubject = new Map(quizzes.map((q) => [q.id, q.subject_id]));
    const agg = new Map<string, { score: number; total: number; n: number }>();
    for (const a of attempts) {
      const sid = quizSubject.get(a.quiz_id);
      if (!sid) continue;
      const v = agg.get(sid) ?? { score: 0, total: 0, n: 0 };
      v.score += a.score;
      v.total += a.total;
      v.n++;
      agg.set(sid, v);
    }
    return [...agg.entries()];
  }, [attempts, quizzes]);

  async function create() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await createClient().functions.invoke(
      "quiz",
      {
        body: {
          subject_id: subjectId,
          focus: focus.trim() || null,
          count,
          types: effectiveSource === "review" ? ["mcq"] : types,
          kind,
          time_limit_minutes: kind === "exam" ? minutes : null,
          source: effectiveSource,
        },
      },
    );
    if (fnError || !data || data.error) {
      let message = data?.error as string | undefined;
      if (!message && fnError) {
        try {
          message = (await (fnError as { context?: Response }).context?.json())
            ?.error;
        } catch {
          /* ignore */
        }
      }
      setBusy(false);
      reportProblem("quiz", problemKind(data, !!fnError), message);
      setError(message ?? "The quiz couldn't be made. Please try again.");
      return;
    }
    router.push(`/quizzes/${data.quiz_id}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
              <ClipboardCheck size={24} aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-semibold">Quizzes &amp; Exams</h1>
              <p className="mt-1 text-sm text-mira-muted">
                Make a practice quiz or a timed exam. You get your score, the
                right answers and rationales, and Nurse Mira tracks which topics
                need more work. Your results are private.
              </p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Subject</span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Choose a subject…</option>
                  {sortedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.code})
                      {mySubjectIds.includes(s.id) ? " ★" : ""}
                      {sheets.some((x) => x.subject_id === s.id)
                        ? " · has study sheets"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Topic (optional)</span>
                <input
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  maxLength={120}
                  placeholder="Leave empty for the whole subject"
                  className={inputClass}
                  list="quiz-topics"
                />
                <datalist id="quiz-topics">
                  {savedForSubject.map((s) => (
                    <option key={s.focus} value={s.focus} />
                  ))}
                </datalist>
              </label>
            </div>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">
                Questions from
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    [
                      "ai",
                      "New AI questions",
                      `PNLE-style, from the shared library · uses 1 of your ${remaining} AI answers left today`,
                    ],
                    [
                      "review",
                      "Saved Review Center questions",
                      canUseSaved
                        ? `Free · from ${savedForSubject.length} study sheet${savedForSubject.length === 1 ? "" : "s"} for this subject`
                        : "Not available yet — no Review Center study sheets for this subject. Make one in the Review Center first.",
                    ],
                  ] as const
                ).map(([value, label, hint]) => {
                  const disabled = value === "review" && !canUseSaved;
                  return (
                    <label
                      key={value}
                      className={`flex gap-2 rounded-lg p-3 text-sm ring-1 ${disabled ? "cursor-not-allowed opacity-60 ring-mira-line" : effectiveSource === value ? "cursor-pointer bg-mira-blue-soft ring-mira-blue" : "cursor-pointer ring-mira-line"}`}
                    >
                      <input
                        type="radio"
                        name="source"
                        disabled={disabled}
                        checked={effectiveSource === value}
                        onChange={() => setSource(value)}
                        className="mt-0.5 accent-mira-blue"
                      />
                      <span>
                        <span className="block font-medium">{label}</span>
                        <span className="text-xs text-mira-muted">{hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {effectiveSource === "ai" && (
              <fieldset>
                <legend className="mb-1 text-sm font-medium">
                  Question types
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TYPE_CHOICES.map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ${types.includes(value) ? "bg-mira-blue-soft text-mira-blue ring-mira-blue" : "ring-mira-line"}`}
                    >
                      <input
                        type="checkbox"
                        checked={types.includes(value)}
                        onChange={(e) =>
                          setTypes((t) =>
                            e.target.checked
                              ? [...t, value]
                              : t.length > 1
                                ? t.filter((x) => x !== value)
                                : t,
                          )
                        }
                        className="accent-mira-blue"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">
                  Number of questions
                </span>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className={inputClass}
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Mode</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as "quiz" | "exam")}
                  className={inputClass}
                >
                  <option value="quiz">
                    Practice quiz (see answers as you go)
                  </option>
                  <option value="exam">Timed exam (answers at the end)</option>
                </select>
              </label>
              {kind === "exam" && (
                <label className="text-sm">
                  <span className="mb-1 block font-medium">
                    Time limit (minutes)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className={inputClass}
                  />
                </label>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={!subjectId || busy}
              className={buttonClass("primary")}
            >
              {busy ? (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              ) : (
                <Sparkles size={18} aria-hidden />
              )}
              {busy
                ? effectiveSource === "ai"
                  ? "Writing your questions… (about 15 seconds)"
                  : "Preparing…"
                : kind === "exam"
                  ? "Create exam"
                  : "Create quiz"}
            </button>
          </form>
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold">My quizzes</h2>
          {list.length === 0 ? (
            <EmptyState title="No quizzes yet">
              Create your first quiz above.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {list.map((q) => {
                const mine = attempts.filter((a) => a.quiz_id === q.id);
                const best = mine.reduce(
                  (m, a) => Math.max(m, pct(a.score, a.total)),
                  0,
                );
                return (
                  <li
                    key={q.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mira-line"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.title}</p>
                      <p className="text-xs text-mira-muted">
                        {q.count} questions ·{" "}
                        {q.kind === "exam"
                          ? `timed ${q.time_limit_minutes} min`
                          : "practice"}{" "}
                        ·{" "}
                        {q.origin === "ai"
                          ? "AI-generated"
                          : "Review Center questions"}{" "}
                        · {when(q.created_at)}
                        {mine.length
                          ? ` · taken ${mine.length}× · best ${best}%`
                          : " · not taken yet"}
                      </p>
                    </div>
                    <Link
                      href={`/quizzes/${q.id}`}
                      className={buttonClass(
                        mine.length ? "secondary" : "primary",
                        "!px-3 !py-1.5",
                      )}
                    >
                      <Play size={15} aria-hidden />{" "}
                      {mine.length ? "Retake" : "Start"}
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        confirm(`Delete “${q.title}” and its results?`) &&
                        startTransition(async () => {
                          if ((await deleteQuiz(q.id)).ok)
                            setList((l) => l.filter((x) => x.id !== q.id));
                        })
                      }
                      className="rounded-lg p-2 text-mira-muted hover:bg-red-50 hover:text-mira-danger"
                      aria-label={`Delete ${q.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Target size={18} className="text-mira-danger" aria-hidden /> Topics
            to improve
          </h2>
          {weak.length === 0 ? (
            <p className="text-sm text-mira-muted">
              Take a few quizzes and topics where you score below 70% will show
              here.
            </p>
          ) : (
            <ul className="space-y-3">
              {weak.map((w) => (
                <li key={w.topic}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{w.topic}</span>
                    <span className="text-mira-muted">{w.percent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-mira-page">
                    <div
                      className="h-1.5 rounded-full bg-mira-danger"
                      style={{ width: `${Math.max(4, w.percent)}%` }}
                    />
                  </div>
                  <a
                    href={`/tutor?ask=${encodeURIComponent(`I keep getting questions about "${w.topic}" wrong. Can you explain it simply and then quiz me?`)}`}
                    className="mt-1 inline-block text-xs text-mira-blue hover:underline"
                  >
                    Study this with the AI Tutor →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <TrendingUp size={18} className="text-mira-blue" aria-hidden /> My
            scores by subject
          </h2>
          {bySubject.length === 0 ? (
            <p className="text-sm text-mira-muted">
              Your average scores will appear here.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {bySubject.map(([sid, v]) => (
                <li key={sid} className="flex justify-between gap-2">
                  <span className="truncate">
                    {subjectById.get(sid)?.title ?? "Subject"}
                  </span>
                  <span className="shrink-0 text-mira-muted">
                    {pct(v.score, v.total)}% · {v.n} attempt
                    {v.n === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="flex items-start gap-2 px-1 text-xs text-mira-muted">
          <Timer size={14} className="mt-0.5 shrink-0" aria-hidden />{" "}
          AI-generated questions are original practice questions, not from
          official or paid exam banks.
        </p>
      </aside>
    </div>
  );
}
