"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  FileDown,
  Info,
  ListChecks,
  Loader2,
  PlusCircle,
  RefreshCw,
  Save,
  SpellCheck,
  Wrench,
} from "lucide-react";
import { Badge, buttonClass, Card } from "@/components/ui";
import { Mira } from "@/components/mira";
import { createClient } from "@/lib/supabase/client";
import { wordDiff } from "@/lib/case/diff";
import { downloadBlob, markdownToDocx } from "@/lib/case/export-docx";
import { invokeCheck } from "../check-home";
import { saveRevisedCaseStudy } from "../actions";

type Section = {
  title: string;
  original: string;
  revised: string | null;
  note?: string;
};
type Change = {
  kind: "added" | "revised" | "corrected" | "check";
  section: string;
  what: string;
  why: string;
};
type Overview = {
  assessment?: string;
  approach?: string;
  key_facts?: string[];
  missing_sections?: string[];
  double_check?: { section: string; issue: string }[];
};
export type CheckRow = {
  id: string;
  title: string;
  format: "chn" | "hospital";
  status: "checking" | "ready";
  sections: Section[];
  parts: { sections: number[]; done: boolean }[];
  overview: Overview | null;
  changes: Change[];
  saved_case_study_id: string | null;
  created_at: string;
};

const KIND: Record<
  "added" | "revised" | "corrected",
  { label: string; Icon: typeof PlusCircle; tone: string }
> = {
  added: { label: "Added", Icon: PlusCircle, tone: "text-mira-success" },
  revised: { label: "Revised", Icon: SpellCheck, tone: "text-mira-blue" },
  corrected: { label: "Corrected", Icon: Wrench, tone: "text-amber-700" },
};

/** [MISSING: …] and [CLARIFY: …] placeholders stand out so the student fills them in. */
function WithMissing({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[(?:MISSING|CLARIFY)[^\]]*\])/g).map((p, i) =>
        /^\[(MISSING|CLARIFY)/.test(p) ? (
          <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Diffed({ a, b }: { a: string; b: string }) {
  const pieces = useMemo(() => wordDiff(a, b), [a, b]);
  return (
    <>
      {pieces.map((p, i) =>
        p.t === "same" ? (
          <Fragment key={i}>{p.s}</Fragment>
        ) : p.t === "add" ? (
          <ins
            key={i}
            className="rounded bg-green-100 text-green-900 no-underline decoration-transparent"
          >
            <WithMissing text={p.s} />
          </ins>
        ) : (
          <del key={i} className="rounded bg-red-50 text-red-700/80">
            {p.s}
          </del>
        ),
      )}
    </>
  );
}

export function CheckResult({ initial }: { initial: CheckRow }) {
  const [c, setC] = useState(initial);
  const [run, setRun] = useState<{
    running: boolean;
    message: string | null;
    error: string | null;
  }>({ running: false, message: null, error: null });
  const [highlight, setHighlight] = useState(true);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(
    initial.saved_case_study_id,
  );
  const [note, setNote] = useState<string | null>(null);
  const running = useRef(false);

  const steps = c.parts.length + 1;
  const done = (c.overview ? 1 : 0) + c.parts.filter((p) => p.done).length;

  const refresh = useCallback(async () => {
    const { data } = await createClient()
      .from("case_checks")
      .select("status, sections, parts, overview, changes")
      .eq("id", c.id)
      .maybeSingle();
    if (data) setC((prev) => ({ ...prev, ...(data as Partial<CheckRow>) }));
    return data?.status as string | undefined;
  }, [c.id]);

  const go = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    let busyTries = 0;
    setRun({ running: true, message: null, error: null });
    while (true) {
      const r = await invokeCheck({ action: "step", id: c.id });
      if (r.ok) {
        busyTries = 0;
        const status = await refresh();
        if (r.data.done || status === "ready") break;
        continue;
      }
      if (r.kind === "busy" && busyTries < 8) {
        busyTries++;
        for (
          let s = Math.max(15, Math.min(90, r.retryAfter || 30));
          s > 0;
          s--
        ) {
          setRun({
            running: true,
            message: `Nurse Mira's free AI is busy — trying again in ${s}s. Your progress is saved.`,
            error: null,
          });
          await new Promise((res) => setTimeout(res, 1000));
        }
        setRun({ running: true, message: null, error: null });
        continue;
      }
      setRun({ running: false, message: null, error: r.message });
      running.current = false;
      return;
    }
    setRun({ running: false, message: null, error: null });
    running.current = false;
  }, [c.id, refresh]);

  useEffect(() => {
    if (initial.status !== "checking") return;
    const t = setTimeout(() => void go(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalText = (s: Section, i: number) =>
    keep.has(i) || !s.revised ? s.original : s.revised;
  const changed = c.sections.map(
    (s) => !!s.revised && s.revised !== s.original,
  );
  const counts = { added: 0, revised: 0, corrected: 0 };
  for (const ch of c.changes)
    if (ch.kind in counts) counts[ch.kind as keyof typeof counts]++;
  const checks = [
    ...(c.overview?.double_check ?? []).map((d) => ({
      section: d.section,
      what: d.issue,
    })),
    ...c.changes
      .filter((ch) => ch.kind === "check")
      .map((ch) => ({ section: ch.section, what: ch.what })),
  ];
  const missingCount = c.sections.reduce(
    (n, s, i) => n + (finalText(s, i).match(/\[(?:MISSING|CLARIFY)[^\]]*\]/g)?.length ?? 0),
    0,
  );

  async function save() {
    setSaving(true);
    setNote(null);
    const r = await saveRevisedCaseStudy(c.id, [...keep]);
    setSaving(false);
    if (r.ok) setSaved(r.id);
    else setNote(r.error);
  }
  async function word() {
    const blob = await markdownToDocx(
      `${c.title} (checked)`,
      c.format === "chn"
        ? "CHN family case presentation"
        : "Nursing case study",
      c.sections.map((s, i) => ({ title: s.title, content: finalText(s, i) })),
    );
    downloadBlob(
      blob,
      `${c.title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "case-study"} (checked).docx`,
    );
  }
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(
        c.sections
          .map((s, i) => `${s.title}\n\n${finalText(s, i)}`)
          .join("\n\n"),
      );
      setNote("Copied the whole improved case study.");
    } catch {
      setNote(
        "Copying didn't work in this browser — use Download Word instead.",
      );
    }
  }

  // ---------- still checking ----------
  if (c.status === "checking") {
    const nextPart = c.parts.find((p) => !p.done);
    const label = !c.overview
      ? "Reading your whole case study…"
      : nextPart
        ? `Checking “${c.sections[nextPart.sections[0]]?.title ?? ""}”${nextPart.sections.length > 1 ? ` and ${nextPart.sections.length - 1} more section${nextPart.sections.length > 2 ? "s" : ""}` : ""}…`
        : "Finishing…";
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/case-studies/check"
          className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline"
        >
          <ArrowLeft size={16} aria-hidden /> Case Study Checker
        </Link>
        <Card className="flex flex-col items-center py-10 text-center">
          <Mira pose="thinking" height={110} />
          <h1 className="mt-3 text-lg font-semibold">{c.title}</h1>
          <p className="mt-1 text-sm text-mira-muted" aria-live="polite">
            {run.message ??
              (run.running
                ? label
                : run.error
                  ? "Paused"
                  : "Ready to continue")}
          </p>
          <div
            className="mt-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-mira-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps}
            aria-valuenow={done}
            aria-label="Progress"
          >
            <div
              className="h-full rounded-full bg-mira-blue transition-all"
              style={{ width: `${(done / steps) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-mira-muted">
            Step {Math.min(done + 1, steps)} of {steps} · about 30 seconds each
            · you can leave this page, your progress is saved
          </p>
          {run.error && (
            <div
              role="alert"
              className="mt-5 max-w-md rounded-lg bg-red-50 p-3 text-sm text-mira-danger"
            >
              <p className="flex items-start gap-2 text-left">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden
                />{" "}
                {run.error}
              </p>
            </div>
          )}
          {!run.running && (
            <button
              type="button"
              onClick={() => void go()}
              className={buttonClass("primary", "mt-4")}
            >
              <RefreshCw size={16} aria-hidden /> Continue
            </button>
          )}
        </Card>
      </div>
    );
  }

  // ---------- results ----------
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/case-studies/check"
        className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline"
      >
        <ArrowLeft size={16} aria-hidden /> Case Study Checker
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-mira-muted">
              Checked case study
            </p>
            <h1 className="mt-1 text-xl font-semibold">{c.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="gray">
                {c.format === "chn" ? "CHN family case" : "Hospital case study"}
              </Badge>
              <Badge tone="green">{counts.added} added</Badge>
              <Badge tone="blue">{counts.revised} revised</Badge>
              <Badge tone="yellow">{counts.corrected} corrected</Badge>
              {checks.length > 0 && (
                <Badge tone="red">{checks.length} to double-check</Badge>
              )}
            </div>
          </div>
          <a href="#what-changed" className={buttonClass("secondary", "!py-2")}>
            <ListChecks size={16} aria-hidden /> See what I changed
          </a>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {saved ? (
            <Link
              href={`/case-studies/${saved}`}
              className={buttonClass("primary")}
            >
              <Check size={16} aria-hidden /> Saved — open the new case study
            </Link>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={buttonClass("primary")}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Save size={16} aria-hidden />
              )}{" "}
              Save as a new case study
            </button>
          )}
          <button
            type="button"
            onClick={word}
            className={buttonClass("secondary")}
          >
            <FileDown size={16} aria-hidden /> Download Word
          </button>
          <button
            type="button"
            onClick={copyAll}
            className={buttonClass("secondary")}
          >
            <Copy size={16} aria-hidden /> Copy all
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
            />{" "}
            Highlight changes
          </label>
        </div>
        {note && (
          <p className="mt-3 text-sm text-mira-muted" role="status">
            {note}
          </p>
        )}
        {saved && (
          <p className="mt-3 text-xs text-mira-muted">
            Saved as a new case study, so your original stays as it was. You can
            keep editing it in the Case Study Builder.
          </p>
        )}
        {highlight && (
          <p className="mt-3 text-xs text-mira-muted">
            <ins className="rounded bg-green-100 px-1 text-green-900 no-underline">
              Green
            </ins>{" "}
            = added by Nurse Mira ·{" "}
            <del className="rounded bg-red-50 px-1 text-red-700/80">red</del> =
            removed ·{" "}
            <mark className="rounded bg-amber-100 px-1 text-amber-900">
              [MISSING] / [CLARIFY]
            </mark>{" "}
            = only you can fill this in
            {missingCount ? ` (${missingCount} in this paper)` : ""}
          </p>
        )}
      </Card>

      {c.sections.map((s, i) => (
        <Card key={i} className="!p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold">{s.title}</h2>
            {changed[i] ? (
              <label className="flex items-center gap-2 text-xs text-mira-muted">
                <input
                  type="checkbox"
                  checked={keep.has(i)}
                  onChange={(e) =>
                    setKeep((k) => {
                      const n = new Set(k);
                      if (e.target.checked) n.add(i);
                      else n.delete(i);
                      return n;
                    })
                  }
                />
                Keep my original for this section
              </label>
            ) : (
              <span
                className={`text-xs ${s.note?.startsWith("Nurse Mira's suggestion") ? "text-amber-700" : "text-mira-muted"}`}
              >
                {s.note ??
                  (s.original.trim()
                    ? "No changes needed"
                    : "Empty in your file — if this part was a picture or table, I couldn't read it")}
              </span>
            )}
          </div>
          <div className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
            {keep.has(i) || !changed[i] ? (
              <WithMissing text={s.original} />
            ) : highlight ? (
              <Diffed a={s.original} b={s.revised!} />
            ) : (
              <WithMissing text={s.revised!} />
            )}
          </div>
        </Card>
      ))}

      {/* Right under the results: what was changed and why */}
      <div id="what-changed" className="scroll-mt-4">
        <Card>
          <div className="flex items-start gap-3">
            <Mira
              pose="confident"
              height={80}
              className="hidden shrink-0 sm:block"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">
                Here&apos;s what I changed
              </h2>
              {c.overview?.assessment && (
                <p className="mt-2 text-sm">{c.overview.assessment}</p>
              )}
            </div>
          </div>
          {c.overview?.approach && (
            <section className="mt-4 rounded-lg bg-mira-blue-soft p-4 text-sm">
              <h3 className="font-semibold text-mira-blue-dark">
                The approach I took
              </h3>
              <p className="mt-1">{c.overview.approach}</p>
            </section>
          )}
          {(["added", "revised", "corrected"] as const).map((k) => {
            const items = c.changes.filter((ch) => ch.kind === k);
            if (!items.length) return null;
            const { label, Icon, tone } = KIND[k];
            return (
              <section key={k} className="mt-5">
                <h3 className={`flex items-center gap-2 font-semibold ${tone}`}>
                  <Icon size={17} aria-hidden /> {label} ({items.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {items.map((ch, i) => (
                    <li key={i} className="rounded-lg bg-mira-page p-3 text-sm">
                      <span className="text-xs font-medium text-mira-muted">
                        {ch.section}
                      </span>
                      <p className="mt-0.5">{ch.what}</p>
                      {ch.why && (
                        <p className="mt-0.5 text-mira-muted">Why: {ch.why}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {checks.length > 0 && (
            <section className="mt-5">
              <h3 className="flex items-center gap-2 font-semibold text-mira-danger">
                <AlertTriangle size={17} aria-hidden /> Please double-check (
                {checks.length})
              </h3>
              <p className="mt-1 text-xs text-mira-muted">
                These parts disagree with each other or look doubtful. I
                didn&apos;t change them, because only you know which is true.
              </p>
              <ul className="mt-2 space-y-2">
                {checks.map((ch, i) => (
                  <li key={i} className="rounded-lg bg-red-50 p-3 text-sm">
                    {ch.section && (
                      <span className="text-xs font-medium text-mira-muted">
                        {ch.section}
                      </span>
                    )}
                    <p className="mt-0.5">{ch.what}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!!c.overview?.missing_sections?.length && (
            <section className="mt-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <Info size={17} aria-hidden /> You might want to add
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {c.overview.missing_sections.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-5 text-xs text-mira-muted">
            Nurse Mira doesn&apos;t make up patient or family details — anything
            that needs information only you have is marked [MISSING]. AI can
            still make mistakes, so read the changes before you submit.
          </p>
        </Card>
      </div>
    </div>
  );
}
