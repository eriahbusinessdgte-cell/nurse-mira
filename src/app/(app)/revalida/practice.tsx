"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Info, Loader2, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui";
import { Mira } from "@/components/mira";
import { createClient } from "@/lib/supabase/client";
import { Md } from "../review/sheet-view";
import { invokeRevalida } from "./revalida-home";
import {
  DIFFICULTY_LABEL, FILTER_LABEL, letter, matchesFilter, QUESTION_COLUMNS, SELF_LABEL, summarize, TYPE_LABEL,
  type RevalidaQuestion, type RevalidaSession, type ReviewFilter, type SelfAssess,
} from "@/lib/revalida";

type Patch = Partial<Pick<RevalidaQuestion, "revealed" | "skipped" | "bookmarked" | "self_assess" | "viewed">>;
const ANSWER_TYPES = new Set(["mcq", "tf", "identification", "recall"]);

export function Practice({ session: initialSession, initialQuestions, reviewTitle }: { session?: RevalidaSession; initialQuestions: RevalidaQuestion[]; reviewTitle?: string }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [qs, setQs] = useState(initialQuestions);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [pos, setPos] = useState(() => (initialSession ? Math.min(initialSession.position, Math.max(0, initialQuestions.length - 1)) : 0));
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<"cards" | "summary">(initialSession?.status === "completed" ? "summary" : "cards");
  const [gen, setGen] = useState<{ running: boolean; message: string | null; error: string | null }>({ running: false, message: null, error: null });
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [newBusy, setNewBusy] = useState(false);
  const failed = useRef(new Map<string, Patch>());
  const pending = useRef(0);
  const genRunning = useRef(false);
  const seen = useRef(new Set<string>()); // cards shown in this visit (saved as "viewed")

  const deck = useMemo(() => qs.map((q, i) => (matchesFilter(q, filter) ? i : -1)).filter((i) => i >= 0), [qs, filter]);
  const current = deck.length ? qs[deck[Math.min(pos, deck.length - 1)]] : null;
  const at = Math.min(pos, Math.max(0, deck.length - 1));
  const generating = session?.status === "generating";

  // ---- saving ----
  const save = useCallback(async (id: string, patch: Patch) => {
    pending.current++;
    setSaveState("saving");
    const merged = { ...(failed.current.get(id) ?? {}), ...patch };
    const { error } = await createClient().from("revalida_questions").update(merged).eq("id", id);
    pending.current--;
    if (error) {
      failed.current.set(id, merged);
      setSaveState("error");
    } else {
      failed.current.delete(id);
      if (!pending.current) setSaveState(failed.current.size ? "error" : "saved");
    }
  }, []);
  const retrySaves = () => failed.current.forEach((patch, id) => save(id, patch));

  const update = (id: string, patch: Patch) => {
    setQs((l) => l.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    void save(id, patch);
  };

  // Mark the card as viewed when it's shown.
  useEffect(() => {
    if (view !== "cards" || !current || current.viewed || seen.current.has(current.id)) return;
    seen.current.add(current.id);
    const id = current.id;
    void createClient().from("revalida_questions").update({ viewed: true }).eq("id", id).then(({ error }) => {
      if (error) seen.current.delete(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, view]);

  // Remember where the student is (session decks only).
  useEffect(() => {
    if (!session || filter !== "all") return;
    const t = setTimeout(() => {
      void createClient().from("revalida_sessions").update({ position: at, updated_at: new Date().toISOString() }).eq("id", session.id);
    }, 600);
    return () => clearTimeout(t);
  }, [at, filter, session]);

  // ---- generation: keep asking for the next batch until the session is ready ----
  const refresh = useCallback(async (sessionId: string) => {
    const supabase = createClient();
    const [{ data: fresh }, { data: s }] = await Promise.all([
      supabase.from("revalida_questions").select(QUESTION_COLUMNS).eq("session_id", sessionId).order("position"),
      supabase.from("revalida_sessions").select("status, generation_note, analysis").eq("id", sessionId).maybeSingle(),
    ]);
    if (fresh) setQs((old) => (fresh as RevalidaQuestion[]).map((f) => old.find((o) => o.id === f.id) ?? f));
    if (s) setSession((prev) => (prev ? { ...prev, ...s } : prev));
    return s?.status;
  }, []);

  const runGeneration = useCallback(async () => {
    if (!session || genRunning.current) return;
    genRunning.current = true;
    let busyTries = 0;
    setGen({ running: true, message: null, error: null });
    while (true) {
      const r = await invokeRevalida({ action: "batch", session_id: session.id });
      if (r.ok) {
        busyTries = 0;
        const status = await refresh(session.id);
        if (r.data.done || status !== "generating") break;
        continue;
      }
      if (r.kind === "busy" && busyTries < 8) {
        busyTries++;
        const wait = Math.max(15, Math.min(90, r.retryAfter || 30));
        for (let s = wait; s > 0; s--) {
          setGen({ running: true, message: `Nurse Mira's free AI is busy — trying again in ${s}s. You can start practising the questions already made.`, error: null });
          await new Promise((res) => setTimeout(res, 1000));
        }
        setGen({ running: true, message: null, error: null });
        continue;
      }
      setGen({ running: false, message: null, error: r.message });
      genRunning.current = false;
      return;
    }
    setGen({ running: false, message: null, error: null });
    genRunning.current = false;
  }, [refresh, session]);

  useEffect(() => {
    if (generating && !genRunning.current) void runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- navigation ----
  const go = (to: number) => {
    setFlipped(false);
    setPos(Math.max(0, Math.min(deck.length - 1, to)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reveal = () => {
    if (!current) return;
    setFlipped(true);
    if (!current.revealed) update(current.id, { revealed: true, viewed: true });
  };
  const nextOrSkip = () => {
    if (!current) return;
    if (!current.revealed && !current.skipped) update(current.id, { skipped: true });
    if (at < deck.length - 1) go(at + 1);
    else if (session && !reviewTitle && !gen.running) void finish();
  };

  // Keyboard: ← → to move, space/enter to reveal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (view !== "cards" || el?.closest("input, textarea, select, summary")) return;
      if (e.key === "ArrowRight") nextOrSkip();
      else if (e.key === "ArrowLeft" && at > 0) go(at - 1);
      else if ((e.key === " " || e.key === "Enter") && !el?.closest("button, a")) {
        e.preventDefault();
        if (flipped) setFlipped(false);
        else reveal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function finish() {
    if (!session) return;
    if (session.status !== "completed") {
      const now = new Date().toISOString();
      const { error } = await createClient().from("revalida_sessions").update({ status: "completed", completed_at: now, updated_at: now }).eq("id", session.id);
      if (!error) setSession({ ...session, status: "completed", completed_at: now });
      else setSaveState("error");
    }
    setView("summary");
  }

  async function newSession() {
    if (!session) return;
    setNewBusy(true);
    const r = await invokeRevalida({ action: "start", case_id: session.case_id, count: session.requested, types: session.types, difficulty: session.difficulty });
    if (!r.ok) {
      setNewBusy(false);
      return setGen((g) => ({ ...g, error: r.message }));
    }
    router.push(`/revalida/${r.data.session_id}`);
  }

  const review = (f: ReviewFilter) => {
    setFilter(f);
    setPos(0);
    setFlipped(false);
    setView("cards");
    window.scrollTo({ top: 0 });
  };

  const saveNote = (
    <span className="text-xs text-mira-muted" aria-live="polite">
      {saveState === "saving" && "Saving…"}
      {saveState === "saved" && "All progress saved"}
      {saveState === "error" && (
        <span className="text-mira-danger">
          Some progress isn&apos;t saved yet.{" "}
          <button type="button" onClick={retrySaves} className="underline">
            Try again
          </button>
        </span>
      )}
    </span>
  );

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Link href="/revalida" className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline">
        <ArrowLeft size={16} aria-hidden /> Practice history
      </Link>
      {saveNote}
    </div>
  );

  // ---------- summary ----------
  if (view === "summary" && session) {
    const s = summarize(qs.map((q) => (seen.current.has(q.id) ? { ...q, viewed: true } : q)));
    const assessed = s.knew + s.partial + s.didnt;
    const stat = (label: string, value: number | string) => (
      <div className="rounded-xl bg-mira-page p-3 text-center">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-mira-muted">{label}</p>
      </div>
    );
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <Card>
          <div className="flex items-start gap-4">
            <Mira pose="celebrate" height={90} className="hidden shrink-0 sm:block" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-mira-muted">Session summary</p>
              <h1 className="mt-1 text-xl font-semibold">{session.case_title}</h1>
              <p className="mt-1 text-sm text-mira-muted">
                {new Date(session.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })} · {DIFFICULTY_LABEL[session.difficulty] ?? session.difficulty}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stat("Questions requested", session.requested)}
            {stat("Questions made", s.generated)}
            {stat("Viewed", s.viewed)}
            {stat("Answers revealed", s.revealed)}
            {stat("Skipped", s.skipped)}
            {stat("Bookmarked", s.bookmarked)}
          </div>
          {session.generation_note && <p className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><Info size={16} className="mt-0.5 shrink-0" aria-hidden />{session.generation_note}</p>}
          <div className="mt-5">
            <h2 className="text-sm font-semibold">Your self-check</h2>
            {assessed ? (
              <ul className="mt-2 space-y-1 text-sm">
                <li>✅ I knew it: <b>{s.knew}</b></li>
                <li>🟡 I partially knew it: <b>{s.partial}</b></li>
                <li>❌ I didn&apos;t know it: <b>{s.didnt}</b></li>
              </ul>
            ) : (
              <p className="mt-1 text-sm text-mira-muted">You didn&apos;t use the self-check this time. That&apos;s fine — it&apos;s optional.</p>
            )}
            <p className="mt-2 text-xs text-mira-muted">This isn&apos;t a score — Nurse Mira doesn&apos;t grade answers you only said in your head.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => review("all")} className={buttonClass("primary")}>
              <RotateCcw size={16} aria-hidden /> Review all questions
            </button>
            {s.bookmarked > 0 && <button type="button" onClick={() => review("bookmarked")} className={buttonClass("secondary")}><Bookmark size={16} aria-hidden /> Bookmarked ({s.bookmarked})</button>}
            {s.didnt > 0 && <button type="button" onClick={() => review("didnt")} className={buttonClass("secondary")}>Didn&apos;t know ({s.didnt})</button>}
            {s.partial > 0 && <button type="button" onClick={() => review("partial")} className={buttonClass("secondary")}>Partially knew ({s.partial})</button>}
            {s.skipped > 0 && <button type="button" onClick={() => review("skipped")} className={buttonClass("secondary")}>Skipped ({s.skipped})</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-mira-line pt-4">
            <button type="button" onClick={newSession} disabled={newBusy} className={buttonClass("accent")}>
              {newBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />} New session — different questions, same case
            </button>
            <Link href="/revalida" className={buttonClass("secondary")}>Back to history</Link>
          </div>
          {gen.error && <p role="alert" className="mt-3 text-sm text-mira-danger">{gen.error}</p>}
        </Card>
      </div>
    );
  }

  // ---------- cards ----------
  const analysis = session?.analysis ?? {};
  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{reviewTitle ?? session?.case_title}</h1>
        {session && (
          <p className="mt-0.5 text-sm text-mira-muted">
            Oral revalida practice · {DIFFICULTY_LABEL[session.difficulty] ?? session.difficulty}
            {filter !== "all" && (
              <>
                {" "}· Reviewing: <b>{FILTER_LABEL[filter]}</b>{" "}
                <button type="button" onClick={() => review("all")} className="text-mira-blue underline">show all</button>
              </>
            )}
          </p>
        )}
      </div>

      {session && (analysis.diagnosis || analysis.missing?.length) ? (
        <details className="mb-4 rounded-xl bg-white p-4 text-sm ring-1 ring-mira-line">
          <summary className="cursor-pointer font-medium">What Nurse Mira found in your case</summary>
          <div className="mt-2 space-y-1.5 text-mira-ink">
            {analysis.diagnosis && <p><b>Diagnosis:</b> {analysis.diagnosis}</p>}
            {!!analysis.key_findings?.length && <p><b>Key findings:</b> {analysis.key_findings.join("; ")}</p>}
            {!!analysis.medications?.length && <p><b>Medications:</b> {analysis.medications.join(", ")}</p>}
            {!!analysis.nursing_diagnoses?.length && <p><b>Nursing diagnoses:</b> {analysis.nursing_diagnoses.join("; ")}</p>}
            {!!analysis.missing?.length && <p className="text-amber-800"><b>Not in your case:</b> {analysis.missing.join("; ")}. Questions won&apos;t treat these as facts about your patient.</p>}
          </div>
        </details>
      ) : null}

      {(gen.running || generating) && !gen.error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-mira-blue-soft p-3 text-sm text-mira-blue-dark" aria-live="polite">
          <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
          {gen.message ?? `Making your questions… ${qs.length} of ${session?.requested} ready. Each one is checked so it doesn't repeat what you've practised before.`}
        </p>
      )}
      {gen.error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-mira-danger">
          <p className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{gen.error}</p>
          {generating && (
            <button type="button" onClick={() => void runGeneration()} className={buttonClass("secondary", "mt-2 !py-1.5")}>
              <RefreshCw size={15} aria-hidden /> Try again
            </button>
          )}
        </div>
      )}
      {session?.generation_note && !generating && <p className="mb-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><Info size={16} className="mt-0.5 shrink-0" aria-hidden />{session.generation_note}</p>}

      {!current ? (
        generating || gen.running ? (
          <Card className="flex min-h-72 flex-col items-center justify-center text-center">
            <Mira pose="thinking" height={110} />
            <p className="mt-3 font-medium">Nurse Mira is reading your case…</p>
            <p className="mt-1 max-w-sm text-sm text-mira-muted">Your first questions will appear here in about a minute.</p>
          </Card>
        ) : (
          <EmptyState title={filter === "all" ? "No questions here" : `No ${FILTER_LABEL[filter].toLowerCase()} questions`}>
            {reviewTitle ? "Bookmark questions or use the self-check while practising, and they'll be collected here." : <button type="button" onClick={() => review("all")} className="text-mira-blue underline">Show all questions</button>}
          </EmptyState>
        )
      ) : (
        <>
          {/* Progress */}
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-mira-muted">
            <span>Question {at + 1} of {filter === "all" && session ? Math.max(deck.length, generating ? session.requested : deck.length) : deck.length}</span>
            <span>{qs.filter((q) => q.revealed).length} revealed</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-mira-line" role="progressbar" aria-valuemin={1} aria-valuemax={deck.length} aria-valuenow={at + 1} aria-label="Progress">
            <div className="h-full rounded-full bg-mira-blue transition-all" style={{ width: `${((at + 1) / Math.max(deck.length, session && filter === "all" ? session.requested : 1)) * 100}%` }} />
          </div>

          <Card className="!p-6 sm:!p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="blue">{TYPE_LABEL[current.qtype] ?? current.qtype}</Badge>
                {current.category && <Badge tone="gray">{current.category}</Badge>}
                {current.hypothetical && <Badge tone="yellow">Hypothetical — not from your case</Badge>}
              </div>
              <button
                type="button"
                onClick={() => update(current.id, { bookmarked: !current.bookmarked })}
                aria-pressed={current.bookmarked}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${current.bookmarked ? "bg-amber-50 text-amber-700" : "text-mira-muted hover:bg-mira-blue-soft"}`}
              >
                {current.bookmarked ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />} {current.bookmarked ? "Bookmarked" : "Bookmark"}
              </button>
            </div>

            <p className="mt-5 text-lg font-medium leading-relaxed sm:text-xl">{current.question}</p>

            {current.options.length > 0 && (
              <ol className="mt-5 space-y-2">
                {current.options.map((o, i) => {
                  const correct = flipped && i === current.answer_index;
                  return (
                    <li key={i} className={`flex gap-3 rounded-lg px-3 py-2.5 ring-1 ${correct ? "bg-green-50 font-medium text-mira-success ring-green-300" : "ring-mira-line"}`}>
                      <span className="font-semibold">{letter(i)}.</span>
                      <span>{o}</span>
                      {correct && <span className="ml-auto shrink-0 text-xs">✓ Correct</span>}
                    </li>
                  );
                })}
              </ol>
            )}

            {!flipped ? (
              <p className="mt-6 text-sm text-mira-muted">Answer it in your head (or out loud), then reveal the answer.</p>
            ) : (
              <div className="mt-6 space-y-4 border-t border-mira-line pt-5 text-[15px] leading-relaxed">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-mira-success">
                    {ANSWER_TYPES.has(current.qtype) ? "Correct answer" : "Model answer"}
                  </h3>
                  <div className="prose-sm mt-1 space-y-2">
                    {current.answer_index !== null && current.options[current.answer_index] ? (
                      <p className="font-medium">{letter(current.answer_index)}. {current.options[current.answer_index]}</p>
                    ) : (
                      <Md>{current.answer}</Md>
                    )}
                  </div>
                  {!ANSWER_TYPES.has(current.qtype) && <p className="mt-1 text-xs text-mira-muted">An example of a strong answer — your own words can be just as right if they cover the key points.</p>}
                </section>
                {current.key_points.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-mira-muted">Key points a good answer covers</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {current.key_points.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                  </section>
                )}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-mira-muted">Rationale</h3>
                  <div className="mt-1 space-y-2"><Md>{current.rationale}</Md></div>
                </section>
                {current.case_link && (
                  <section className="rounded-lg bg-mira-blue-soft p-3 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-mira-blue-dark">Why it matters for this case</h3>
                    <p className="mt-1">{current.case_link}</p>
                  </section>
                )}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-mira-muted">How did you do? <span className="font-normal normal-case">(optional)</span></h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(Object.keys(SELF_LABEL) as SelfAssess[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={current.self_assess === k}
                        onClick={() => update(current.id, { self_assess: current.self_assess === k ? null : k })}
                        className={buttonClass(current.self_assess === k ? "primary" : "secondary", "!px-3 !py-1.5")}
                      >
                        {SELF_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            <div className="mt-7 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:justify-between">
              <button type="button" onClick={() => go(at - 1)} disabled={at === 0} className={buttonClass("secondary", "!px-3")} aria-label="Previous question">
                <ChevronLeft size={16} aria-hidden /> <span className="hidden sm:inline">Previous</span>
              </button>
              {flipped ? (
                <button type="button" onClick={() => setFlipped(false)} className={buttonClass("secondary", "!px-3")}>
                  <EyeOff size={16} aria-hidden /> Hide answer
                </button>
              ) : (
                <button type="button" onClick={reveal} className={buttonClass("primary", "!px-3 sm:!px-5")}>
                  <Eye size={16} aria-hidden /> Reveal Answer
                </button>
              )}
              <button type="button" onClick={nextOrSkip} disabled={at >= deck.length - 1 && (!session || !!reviewTitle || gen.running)} className={buttonClass("secondary", "!px-3")}>
                {current.revealed || current.skipped ? (at >= deck.length - 1 && session && !gen.running ? "Summary" : "Next") : "Skip"} <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </Card>

          {/* Jump to any card: skipped ones are amber, revealed ones blue */}
          <div className="mt-5">
            <p className="mb-2 text-xs text-mira-muted">Jump to a question — <span className="text-amber-700">amber = skipped</span>, <span className="text-mira-blue">blue = answer seen</span>, ★ = bookmarked</p>
            <div className="flex flex-wrap gap-1.5">
              {deck.map((qi, i) => {
                const q = qs[qi];
                const tone = q.revealed ? "bg-mira-blue-soft text-mira-blue-dark" : q.skipped ? "bg-amber-50 text-amber-700" : "bg-white text-mira-muted";
                return (
                  <button key={q.id} type="button" onClick={() => go(i)} aria-label={`Question ${i + 1}${q.skipped && !q.revealed ? ", skipped" : ""}${q.revealed ? ", answer seen" : ""}${q.bookmarked ? ", bookmarked" : ""}`} aria-current={i === at} className={`h-8 min-w-8 rounded-md px-1.5 text-xs font-medium ring-1 ${tone} ${i === at ? "ring-2 ring-mira-blue" : "ring-mira-line"}`}>
                    {i + 1}{q.bookmarked ? "★" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {session && !reviewTitle && (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-mira-line pt-4">
              <button type="button" onClick={finish} disabled={gen.running} className={buttonClass("secondary")}>
                <Flag size={16} aria-hidden /> {session.status === "completed" ? "See summary" : "Finish session"}
              </button>
              {gen.running && <span className="text-xs text-mira-muted">You can finish once the questions are made.</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
