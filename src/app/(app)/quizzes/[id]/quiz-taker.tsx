"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Flag, MessageCircleHeart, Play, RotateCcw, X } from "lucide-react";
import { buttonClass, Card, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { answerText, grade, isCorrect, TYPE_LABEL, type Given, type Question, type Result } from "@/lib/quiz/grade";

type Quiz = {
  id: string;
  title: string;
  kind: "quiz" | "exam";
  time_limit_minutes: number | null;
  questions: Question[];
  origin: string;
  sources: { n: number; title: string; page: number | null }[];
};
type Attempt = { id: string; score: number; total: number; finished_at: string; timed_out: boolean };
type Run = { order: number[]; optionOrder: Record<string, number[]>; startedAt: string; endsAt: number | null };

const stripCites = (t: string) => t.replace(/\s*\[S\d{1,2}\]/g, "");
const pct = (s: number, t: number) => (t ? Math.round((s / t) * 100) : 0);
function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function AnswerInput({ q, run, value, onChange, locked }: { q: Question; run: Run; value: Given; onChange: (v: Given) => void; locked: boolean }) {
  if (q.type === "tf") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={locked}
            onClick={() => onChange(v)}
            className={`rounded-lg px-3 py-3 text-sm font-medium ring-1 ${value === v ? "bg-mira-blue-soft text-mira-blue ring-mira-blue" : "bg-white ring-mira-line hover:ring-mira-blue"}`}
          >
            {v ? "True" : "False"}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "identification") {
    return (
      <input
        value={typeof value === "string" ? value : ""}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer"
        className={inputClass}
        autoComplete="off"
        aria-label="Your answer"
      />
    );
  }
  const order = run.optionOrder[q.id] ?? q.options.map((_, i) => i);
  const multi = q.type === "multi";
  const chosen = multi ? (Array.isArray(value) ? value : []) : value;
  return (
    <div className="grid gap-2">
      {order.map((optIndex, pos) => {
        const on = multi ? (chosen as number[]).includes(optIndex) : chosen === optIndex;
        return (
          <button
            key={optIndex}
            type="button"
            disabled={locked}
            onClick={() => {
              if (!multi) return onChange(optIndex);
              const set = new Set(chosen as number[]);
              if (set.has(optIndex)) set.delete(optIndex);
              else set.add(optIndex);
              onChange([...set]);
            }}
            className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm ring-1 ${on ? "bg-mira-blue-soft ring-mira-blue" : "bg-white ring-mira-line hover:ring-mira-blue"}`}
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${multi ? "rounded" : "rounded-full"} border ${on ? "border-mira-blue bg-mira-blue text-white" : "border-mira-line"}`}>
              {on && <Check size={13} />}
            </span>
            <span>
              <span className="font-semibold">{String.fromCharCode(65 + pos)}.</span> {stripCites(q.options[optIndex])}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ q, given }: { q: Question; given: Given }) {
  const ok = isCorrect(q, given);
  return (
    <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
      <p className="font-semibold">{ok ? "✓ Correct!" : `✗ Answer: ${stripCites(answerText(q))}`}</p>
      {q.rationale && <p className="mt-1 text-mira-ink">{stripCites(q.rationale)}</p>}
    </div>
  );
}

export function QuizTaker({ quiz, attempts: initialAttempts }: { quiz: Quiz; attempts: Attempt[] }) {
  const qs = quiz.questions;
  const exam = quiz.kind === "exam";
  const [stage, setStage] = useState<"intro" | "running" | "done">("intro");
  const [run, setRun] = useState<Run | null>(null);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Given>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<(Result & { timedOut: boolean }) | null>(null);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [now, setNow] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  function start() {
    const optionOrder: Record<string, number[]> = {};
    for (const q of qs) if ("options" in q) optionOrder[q.id] = shuffled(q.options.length);
    const minutes = exam ? (quiz.time_limit_minutes ?? qs.length * 1.5) : null;
    setRun({ order: shuffled(qs.length), optionOrder, startedAt: new Date().toISOString(), endsAt: minutes ? Date.now() + minutes * 60_000 : null });
    setAnswers({});
    setChecked({});
    setFlagged({});
    setResult(null);
    setPos(0);
    setSaveError(null);
    submitting.current = false;
    setNow(Date.now());
    setStage("running");
    window.scrollTo({ top: 0 });
  }

  const submit = useCallback(
    async (timedOut = false) => {
      if (!run || submitting.current) return;
      submitting.current = true;
      const r = grade(qs, answers);
      setResult({ ...r, timedOut });
      setStage("done");
      window.scrollTo({ top: 0 });
      const supabase = createClient();
      const user = (await supabase.auth.getSession()).data.session?.user;
      const { data, error } = await supabase
        .from("quiz_attempts")
        .insert({
          quiz_id: quiz.id,
          student_id: user?.id,
          started_at: run.startedAt,
          finished_at: new Date().toISOString(),
          answers,
          score: r.score,
          total: r.total,
          by_topic: r.byTopic,
          timed_out: timedOut,
        })
        .select("id, score, total, finished_at, timed_out")
        .single();
      if (error || !data) setSaveError("Your score couldn't be saved (check your internet). The results below are still correct.");
      else setAttempts((a) => [data as Attempt, ...a]);
    },
    [answers, qs, quiz.id, run],
  );

  // Exam timer.
  useEffect(() => {
    if (stage !== "running" || !run?.endsAt) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= run.endsAt!) {
        clearInterval(t);
        submit(true);
      }
    }, 500);
    return () => clearInterval(t);
  }, [stage, run, submit]);

  if (stage === "intro" || !run) {
    const best = attempts.reduce((m, a) => Math.max(m, pct(a.score, a.total)), 0);
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Link href="/quizzes" className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline">
          <ArrowLeft size={16} aria-hidden /> Quizzes &amp; Exams
        </Link>
        <Card>
          <h1 className="text-xl font-semibold">{quiz.title}</h1>
          <ul className="mt-3 space-y-1 text-sm text-mira-muted">
            <li>
              {qs.length} questions · {[...new Set(qs.map((q) => TYPE_LABEL[q.type]))].join(", ")}
            </li>
            <li>{exam ? `Timed exam: ${quiz.time_limit_minutes} minutes. Answers and rationales are shown at the end.` : "Practice quiz: check each answer as you go."}</li>
            <li>Questions and answer choices are shuffled every time you take it.</li>
            <li>{quiz.origin === "ai" ? "AI-generated practice questions — not from an official exam bank." : "Questions from Review Center study sheets."}</li>
          </ul>
          <button type="button" onClick={start} className={buttonClass("primary", "mt-5")}>
            <Play size={18} aria-hidden /> {attempts.length ? "Retake" : "Start"} {exam ? "exam" : "quiz"}
          </button>
        </Card>
        {attempts.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">Previous attempts · best {best}%</h2>
            <ul className="divide-y divide-mira-line text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex justify-between py-2">
                  <span>{new Date(a.finished_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="font-medium">
                    {a.score}/{a.total} ({pct(a.score, a.total)}%){a.timed_out ? " · time ran out" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  if (stage === "done" && result) {
    const percent = pct(result.score, result.total);
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="text-center">
          <p className="text-sm text-mira-muted">{quiz.title}</p>
          <p className={`mt-2 text-5xl font-bold ${percent >= 75 ? "text-green-700" : percent >= 50 ? "text-amber-600" : "text-mira-danger"}`}>{percent}%</p>
          <p className="mt-1 font-medium">
            {result.score} of {result.total} correct{result.timedOut ? " · time ran out" : ""}
          </p>
          <p className="mt-1 text-sm text-mira-muted">{percent >= 75 ? "Great work! Keep it up." : percent >= 50 ? "Good effort — review the topics below." : "Keep going — the rationales below will help."}</p>
          {saveError && <p className="mt-2 text-sm text-mira-danger">{saveError}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={start} className={buttonClass("primary")}>
              <RotateCcw size={17} aria-hidden /> Retake
            </button>
            <Link href="/quizzes" className={buttonClass("secondary")}>
              Back to quizzes
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Performance by topic</h2>
          <ul className="space-y-2.5">
            {Object.entries(result.byTopic)
              .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
              .map(([topic, v]) => {
                const p = pct(v.right, v.total);
                return (
                  <li key={topic}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{topic}</span>
                      <span className="text-mira-muted">
                        {v.right}/{v.total}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-mira-page">
                      <div className={`h-1.5 rounded-full ${p >= 70 ? "bg-green-600" : "bg-mira-danger"}`} style={{ width: `${Math.max(4, p)}%` }} />
                    </div>
                    {p < 70 && (
                      <a href={`/tutor?ask=${encodeURIComponent(`Help me understand "${topic}" — I got it wrong in a quiz.`)}`} className="text-xs text-mira-blue hover:underline">
                        <MessageCircleHeart size={12} className="mr-1 inline" aria-hidden />
                        Needs improvement — study it with the AI Tutor
                      </a>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>

        <h2 className="text-lg font-semibold">Answers and rationales</h2>
        {run.order.map((qi, n) => {
          const q = qs[qi];
          const given = answers[q.id];
          const ok = isCorrect(q, given);
          const givenText =
            given === undefined || given === null || given === "" || (Array.isArray(given) && !given.length)
              ? "No answer"
              : q.type === "tf"
                ? given
                  ? "True"
                  : "False"
                : q.type === "identification"
                  ? String(given)
                  : (Array.isArray(given) ? given : [given as number]).map((i) => stripCites(q.options[i] ?? "")).join("; ");
          return (
            <Card key={q.id} className="!p-4">
              <p className="flex items-start gap-2 font-medium">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${ok ? "bg-green-600" : "bg-mira-danger"}`}>{ok ? <Check size={13} /> : <X size={13} />}</span>
                <span>
                  {n + 1}. {stripCites(q.question)}
                </span>
              </p>
              <p className="mt-2 text-sm">
                <span className="text-mira-muted">Your answer:</span> {givenText}
              </p>
              {!ok && (
                <p className="text-sm">
                  <span className="text-mira-muted">Correct answer:</span> <span className="font-medium text-green-800">{stripCites(answerText(q))}</span>
                </p>
              )}
              {q.rationale && <p className="mt-2 rounded-lg bg-mira-page px-3 py-2 text-sm">{stripCites(q.rationale)}</p>}
              <p className="mt-1 text-xs text-mira-muted">
                {TYPE_LABEL[q.type]} · {q.topic}
              </p>
            </Card>
          );
        })}
        {quiz.sources.length > 0 && (
          <p className="text-xs text-mira-muted">Based on: {[...new Set(quiz.sources.map((s) => s.title))].join(", ")}</p>
        )}
      </div>
    );
  }

  // Running
  const q = qs[run.order[pos]];
  const given = answers[q.id];
  const answeredCount = qs.filter((x) => {
    const a = answers[x.id];
    return a !== undefined && a !== null && a !== "" && !(Array.isArray(a) && !a.length);
  }).length;
  const isChecked = !exam && checked[q.id];
  const hasAnswer = given !== undefined && given !== null && given !== "" && !(Array.isArray(given) && !given.length);
  const left = run.endsAt ? run.endsAt - now : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-medium">{quiz.title}</p>
        <span className="text-sm text-mira-muted">
          {answeredCount}/{qs.length} answered
        </span>
        {left !== null && (
          <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${left < 60_000 ? "bg-red-50 text-mira-danger" : "bg-mira-blue-soft text-mira-blue"}`} role="timer" aria-live="off">
            <Clock size={15} aria-hidden /> {fmt(left)}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-white ring-1 ring-mira-line">
        <div className="h-1.5 rounded-full bg-mira-blue transition-all" style={{ width: `${((pos + 1) / qs.length) * 100}%` }} />
      </div>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-mira-muted">
          Question {pos + 1} of {qs.length} · {TYPE_LABEL[q.type]}
        </p>
        <p className="mt-2 whitespace-pre-line text-base font-medium">{stripCites(q.question)}</p>
        {q.type === "multi" && <p className="mt-1 text-xs text-mira-muted">Select all that apply.</p>}
        <div className="mt-4">
          <AnswerInput q={q} run={run} value={given} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} locked={!!isChecked} />
        </div>
        {isChecked && <Feedback q={q} given={given} />}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPos((p) => Math.max(0, p - 1))} disabled={pos === 0} className={buttonClass("secondary", "!px-3")}>
            <ChevronLeft size={17} aria-hidden /> Back
          </button>
          {!exam && !isChecked && (
            <button type="button" onClick={() => setChecked((c) => ({ ...c, [q.id]: true }))} disabled={!hasAnswer} className={buttonClass("accent")}>
              Check answer
            </button>
          )}
          {exam && (
            <button
              type="button"
              onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}
              className={buttonClass("secondary", flagged[q.id] ? "!text-amber-700 !ring-amber-300" : "")}
            >
              <Flag size={16} aria-hidden /> {flagged[q.id] ? "Flagged" : "Flag for review"}
            </button>
          )}
          <span className="flex-1" />
          {pos < qs.length - 1 ? (
            <button type="button" onClick={() => setPos((p) => p + 1)} className={buttonClass("primary", "!px-3")}>
              Next <ChevronRight size={17} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (answeredCount < qs.length && !confirm(`${qs.length - answeredCount} question(s) have no answer. Submit anyway?`) ? null : submit(false))}
              className={buttonClass("primary")}
            >
              <Check size={17} aria-hidden /> Submit {exam ? "exam" : "quiz"}
            </button>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5" aria-label="Jump to a question">
        {run.order.map((qi, i) => {
          const x = qs[qi];
          const a = answers[x.id];
          const done = a !== undefined && a !== null && a !== "" && !(Array.isArray(a) && !a.length);
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setPos(i)}
              className={`h-9 w-9 rounded-lg text-sm font-medium ring-1 ${i === pos ? "bg-mira-blue text-white ring-mira-blue" : flagged[x.id] ? "bg-amber-50 text-amber-800 ring-amber-300" : done ? "bg-mira-blue-soft text-mira-blue ring-mira-blue-soft" : "bg-white ring-mira-line"}`}
              aria-label={`Question ${i + 1}${done ? ", answered" : ""}${flagged[x.id] ? ", flagged" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
