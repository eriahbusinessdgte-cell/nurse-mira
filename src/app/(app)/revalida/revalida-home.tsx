"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bookmark, ChevronDown, ClipboardPaste, FileHeart, FileUp, History, Loader2, Mic, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge, buttonClass, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { Mira } from "@/components/mira";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { ACCEPT_ATTR, extractText } from "@/lib/library/extract";
import { answersNeeded, caseTooShort, DIFFICULTY_LABEL, MAX_QUESTIONS, TYPE_KEYS, TYPE_LABEL } from "@/lib/revalida";

export type CaseOption = { id: string; title: string; updated_at: string };
export type HistoryItem = {
  id: string;
  case_id: string;
  case_title: string;
  requested: number;
  difficulty: string;
  status: "generating" | "ready" | "completed";
  created_at: string;
  completed_at: string | null;
  counts: { n: number; revealed: number; bookmarked: number; knew: number; partial: number; didnt: number };
};

export async function invokeRevalida(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("revalida", { body });
  if (error || !data || data.error) {
    let message = data?.error as string | undefined;
    if (!message && error) {
      try {
        message = (await (error as { context?: Response }).context?.json())?.error;
      } catch {
        /* ignore */
      }
    }
    if (!["limit", "busy", "invalid"].includes(data?.kind)) reportProblem("revalida", problemKind(data, !!error), message);
    return { ok: false as const, kind: (data?.kind as string) ?? "unreachable", retryAfter: Number(data?.retry_after) || 0, message: message ?? "Nurse Mira couldn't be reached. Check your internet and try again." };
  }
  return { ok: true as const, data };
}

type Source = "case_study" | "upload" | "pasted";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function RevalidaHome({ cases, history: initialHistory, remaining, preselect, totals }: { cases: CaseOption[]; history: HistoryItem[]; remaining: number; preselect: string | null; totals: { bookmarked: number; difficult: number } }) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [source, setSource] = useState<Source>(cases.length ? "case_study" : "pasted");
  const [caseId, setCaseId] = useState(preselect && cases.some((c) => c.id === preselect) ? preselect : (cases[0]?.id ?? ""));
  const [pasted, setPasted] = useState("");
  const [title, setTitle] = useState("");
  const [upload, setUpload] = useState<{ name: string; text: string } | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [count, setCount] = useState(20);
  const [custom, setCustom] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("challenging");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File) {
    setError(null);
    setUpload(null);
    setReading("Reading the file…");
    try {
      const out = await extractText(file, (m) => setReading(m));
      const text = out.pages.map((p) => p.text).join("\n\n").trim();
      if (caseTooShort(text)) {
        setError(
          out.unreadablePages.length
            ? "Nurse Mira couldn't read enough of this file (some pages look like unclear photos). Try a clearer file, or paste the case text instead."
            : "Nurse Mira could only read a little text from this file — not enough for revalida questions. Try another file, or paste the case text instead.",
        );
      } else {
        setUpload({ name: file.name, text });
        if (!title) setTitle(file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 120));
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "This file couldn't be read. Try another file, or paste the case text instead.");
    }
    setReading(null);
  }

  async function begin(extra: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    const r = await invokeRevalida({ action: "start", count, types, difficulty, ...extra });
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    router.push(`/revalida/${r.data.session_id}`);
  }

  function generate() {
    if (source === "case_study") {
      if (!caseId) return setError("Choose one of your case studies first.");
      return begin({ source, case_study_id: caseId });
    }
    const text = source === "upload" ? (upload?.text ?? "") : pasted;
    if (source === "upload" && !upload) return setError("Choose a file first.");
    if (caseTooShort(text)) return setError("Please add more of the case (at least a short paragraph about the patient, findings and care) so Nurse Mira has enough to ask about.");
    return begin({ source, content: text, title: title.trim() });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this practice session? Its questions, bookmarks and answers will be removed. Your case study itself is not touched.")) return;
    const { error: e } = await createClient().from("revalida_sessions").delete().eq("id", id);
    if (e) return setError("That session couldn't be deleted. Please try again.");
    setHistory((h) => h.filter((s) => s.id !== id));
  }

  const needed = answersNeeded(count);
  const sourceButton = (s: Source, label: string, Icon: typeof FileHeart) => (
    <button
      type="button"
      onClick={() => {
        setSource(s);
        setError(null);
      }}
      aria-pressed={source === s}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 transition ${source === s ? "bg-mira-blue text-white ring-mira-blue" : "bg-white text-mira-ink ring-mira-line hover:bg-mira-blue-soft"}`}
    >
      <Icon size={16} aria-hidden /> {label}
    </button>
  );
  const unfinished = history.filter((s) => s.status !== "completed");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Oral Revalida Practice" description="Practise for your case presentation defense. Nurse Mira reads your case and asks the questions a clinical instructor would — as flashcards you answer in your head, then reveal." />

      <Card>
        <div className="flex items-start gap-4">
          <Mira pose="confident" height={88} className="hidden shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">1. Choose your case</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {sourceButton("case_study", "My case studies", FileHeart)}
              {sourceButton("upload", "Upload a file", FileUp)}
              {sourceButton("pasted", "Paste it", ClipboardPaste)}
            </div>

            <div className="mt-4">
              {source === "case_study" &&
                (cases.length ? (
                  <label className="block text-sm font-medium">
                    Case study
                    <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={inputClass}>
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-mira-muted">Nurse Mira uses everything saved in it — the case information and every section you wrote.</span>
                  </label>
                ) : (
                  <p className="text-sm text-mira-muted">
                    You don&apos;t have a saved case study yet. Make one in{" "}
                    <Link href="/case-studies" className="text-mira-blue underline">
                      Case Studies
                    </Link>
                    , or upload or paste your case instead.
                  </p>
                ))}

              {source === "upload" && (
                <div>
                  <label className={buttonClass("secondary", "cursor-pointer")}>
                    <FileUp size={16} aria-hidden /> Choose file
                    <input type="file" accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
                  </label>
                  <p className="mt-1 text-xs text-mira-muted">PDF, Word, PowerPoint, text or a photo. It&apos;s read here and saved only to your private practice.</p>
                  {reading && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-mira-muted">
                      <Loader2 size={15} className="animate-spin" aria-hidden /> {reading}
                    </p>
                  )}
                  {upload && (
                    <div className="mt-3 rounded-lg bg-mira-page p-3 text-sm">
                      <p className="font-medium">✓ Read “{upload.name}” — {upload.text.length.toLocaleString()} characters.</p>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-mira-blue">Check what was read</summary>
                        <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-mira-muted">{upload.text.slice(0, 4000)}{upload.text.length > 4000 ? "…" : ""}</p>
                      </details>
                    </div>
                  )}
                </div>
              )}

              {source === "pasted" && (
                <label className="block text-sm font-medium">
                  Paste your case study
                  <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={9} maxLength={40000} placeholder="Paste the whole case — profile, history, assessment, labs, medications, care plan… No special format needed." className={inputClass} />
                  <span className="mt-1 block text-xs font-normal text-mira-muted">Use “Patient A” instead of real names.</span>
                </label>
              )}

              {source !== "case_study" && (
                <label className="mt-3 block text-sm font-medium">
                  Case name <span className="font-normal text-mira-muted">(optional)</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Ectopic pregnancy – Group 3" className={inputClass} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-mira-line pt-4">
          <button type="button" onClick={() => setShowOptions((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-mira-blue" aria-expanded={showOptions}>
            <ChevronDown size={16} className={`transition ${showOptions ? "rotate-180" : ""}`} aria-hidden />
            2. Options <span className="font-normal text-mira-muted">(optional) — {count} questions · {types.length ? `${types.length} type${types.length > 1 ? "s" : ""}` : "mixed types"} · {DIFFICULTY_LABEL[difficulty]}</span>
          </button>
          {showOptions && (
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-medium">Number of questions</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[10, 20, 30].map((n) => (
                    <button key={n} type="button" onClick={() => { setCount(n); setCustom(false); }} aria-pressed={!custom && count === n} className={buttonClass(!custom && count === n ? "primary" : "secondary", "!px-3 !py-1.5")}>
                      {n}
                    </button>
                  ))}
                  <button type="button" onClick={() => setCustom(true)} aria-pressed={custom} className={buttonClass(custom ? "primary" : "secondary", "!px-3 !py-1.5")}>
                    Custom
                  </button>
                  {custom && (
                    <input type="number" min={1} max={MAX_QUESTIONS} value={count} onChange={(e) => setCount(Math.max(1, Math.min(MAX_QUESTIONS, Number(e.target.value) || 1)))} aria-label="Custom number of questions" className={`${inputClass} !mt-0 !w-20 !py-1.5`} />
                  )}
                </div>
                <p className="mt-1 text-xs text-mira-muted">Up to {MAX_QUESTIONS} per session.</p>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium">Difficulty</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(DIFFICULTY_LABEL).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setDifficulty(k)} aria-pressed={difficulty === k} className={buttonClass(difficulty === k ? "primary" : "secondary", "!px-3 !py-1.5")}>
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium">
                  Question types <span className="font-normal text-mira-muted">— leave all unticked for a balanced mix</span>
                </legend>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                  {TYPE_KEYS.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={types.includes(t)} onChange={(e) => setTypes((l) => (e.target.checked ? [...l, t] : l.filter((x) => x !== t)))} />
                      {TYPE_LABEL[t]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-mira-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={generate} disabled={busy || !!reading} className={buttonClass("accent", "!px-5 !py-3 text-base")}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Mic size={18} aria-hidden />} Generate My Oral Revalida
          </button>
          <p className="text-xs text-mira-muted">
            Uses about {needed} AI answer{needed > 1 ? "s" : ""} ({remaining} left today). Questions appear as they&apos;re made.
          </p>
        </div>
      </Card>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <History size={18} aria-hidden /> My practice history
        </h2>
        <div className="flex flex-wrap gap-2">
          {totals.bookmarked > 0 && (
            <Link href="/revalida/review?filter=bookmarked" className={buttonClass("secondary", "!py-2")}>
              <Bookmark size={15} aria-hidden /> Bookmarked ({totals.bookmarked})
            </Link>
          )}
          {totals.difficult > 0 && (
            <Link href="/revalida/review?filter=difficult" className={buttonClass("secondary", "!py-2")}>
              <RotateCcw size={15} aria-hidden /> Questions I found hard ({totals.difficult})
            </Link>
          )}
        </div>
      </div>
      {unfinished.length > 0 && <p className="mt-1 text-sm text-mira-muted">You have {unfinished.length} unfinished session{unfinished.length > 1 ? "s" : ""} — pick up where you left off.</p>}

      <div className="mt-3 space-y-3">
        {history.length === 0 && <EmptyState title="No practice sessions yet">Choose a case above and press Generate. Every session is saved here so you can continue or review it later.</EmptyState>}
        {history.map((s) => {
          const c = s.counts;
          const assessed = c.knew + c.partial + c.didnt;
          return (
            <Card key={s.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.case_title}</p>
                  <p className="mt-0.5 text-xs text-mira-muted">
                    {fmt(s.created_at)} · {c.n} of {s.requested} questions · {DIFFICULTY_LABEL[s.difficulty] ?? s.difficulty}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.status === "completed" ? <Badge tone="green">Completed</Badge> : <Badge tone="yellow">Unfinished</Badge>}
                    {c.bookmarked > 0 && <Badge tone="blue">{c.bookmarked} bookmarked</Badge>}
                    {assessed > 0 && (
                      <Badge tone="gray">
                        Knew {c.knew} · Partly {c.partial} · Didn&apos;t {c.didnt}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/revalida/${s.id}`} className={buttonClass("primary", "!py-2")}>
                    <Play size={15} aria-hidden /> {s.status === "completed" ? "Review" : "Continue"}
                  </Link>
                  <button type="button" disabled={busy} onClick={() => begin({ case_id: s.case_id })} className={buttonClass("secondary", "!py-2")} title="A new set of different questions for the same case">
                    <Plus size={15} aria-hidden /> New session
                  </button>
                  <button type="button" onClick={() => remove(s.id)} className={buttonClass("danger", "!px-2.5 !py-2")} aria-label={`Delete session for ${s.case_title}`}>
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
