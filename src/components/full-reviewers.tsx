"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpenText, Loader2, Pause, Play, Printer, Trash2 } from "lucide-react";
import { Badge, buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { Flashcards, Md, Questions, stripCites } from "@/app/(app)/review/sheet-view";
import type { SheetContent } from "@/app/(app)/review/review-center";

export type ReviewerPart = {
  title: string;
  summary: string;
  key_points: { title: string; explanation: string }[];
  terms: { term: string; definition: string }[];
  nursing_implications: string[];
  practice_questions: SheetContent["practice_questions"];
  flashcards: SheetContent["flashcards"];
  quick_review: string[];
  pages: [number | null, number | null];
};
export type ReviewerRow = {
  id: string;
  document_id: string;
  created_by: string;
  shared: boolean;
  title: string;
  status: "building" | "ready";
  plan: { from: number; to: number; pages: [number | null, number | null] }[];
  parts: ReviewerPart[];
  created_at: string;
};
export type ReviewerSummary = Pick<ReviewerRow, "id" | "document_id" | "created_by" | "shared" | "title" | "status" | "created_at"> & { total: number; done: number };
export type DocOption = { id: string; title: string; page_count: number | null; chunk_count: number };

const pagesLabel = (p: [number | null, number | null]) => (p[0] ? `p. ${p[0]}${p[1] && p[1] !== p[0] ? `–${p[1]}` : ""}` : "");

async function call(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("full-review", { body });
  if (error || !data || data.error) {
    let message = data?.error as string | undefined;
    if (!message && error) {
      try {
        message = (await (error as { context?: Response }).context?.json())?.error;
      } catch {
        /* ignore */
      }
    }
    if (data?.kind !== "busy" && data?.kind !== "limit") reportProblem("review", problemKind(data, !!error), message);
    return { ok: false as const, kind: (data?.kind as string) ?? "unavailable", message: message ?? "Something went wrong. Please try again.", retry: Number(data?.retry_after ?? 45) };
  }
  return { ok: true as const, data };
}

/** The list of full reviewers + "make a full reviewer". Opens a reviewer in place. */
export function FullReviewers({
  docs,
  reviewers,
  me,
  isAdmin,
  initial,
  initialDocId,
  basePath,
}: {
  docs: DocOption[];
  reviewers: ReviewerSummary[];
  me: string;
  isAdmin: boolean;
  initial: ReviewerRow | null;
  initialDocId?: string | null;
  basePath: string;
}) {
  const [open, setOpen] = useState<ReviewerRow | null>(initial);
  const [list, setList] = useState(reviewers);
  const [docId, setDocId] = useState(initialDocId ?? "");
  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = docs.find((d) => d.id === docId);
  const big = (doc?.chunk_count ?? 0) > 300;

  const show = (r: ReviewerRow) => {
    setOpen(r);
    window.history.replaceState(null, "", `${basePath}?full=${r.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function openById(id: string) {
    setError(null);
    const { data } = await createClient().from("full_reviewers").select("*").eq("id", id).maybeSingle();
    if (data) show(data as ReviewerRow);
    else setError("That reviewer couldn't be opened. It may have been deleted.");
  }

  async function start() {
    if (!docId || busy) return;
    setBusy(true);
    setError(null);
    const r = await call({
      action: "start",
      document_id: docId,
      shared: isAdmin ? share : false,
      from_page: fromPage ? Number(fromPage) : null,
      to_page: toPage ? Number(toPage) : null,
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    const rv = r.data.reviewer as ReviewerRow;
    setList((l) => [summaryOf(rv), ...l.filter((x) => x.id !== rv.id)]);
    show(rv);
  }

  if (open) {
    return (
      <ReviewerView
        reviewer={open}
        canBuild={open.created_by === me || (open.shared && isAdmin)}
        canDelete={open.created_by === me || isAdmin}
        onChange={(rv) => {
          setOpen(rv);
          setList((l) => l.map((x) => (x.id === rv.id ? summaryOf(rv) : x)));
        }}
        onDeleted={() => {
          setList((l) => l.filter((x) => x.id !== open.id));
          setOpen(null);
          window.history.replaceState(null, "", basePath);
        }}
        onBack={() => {
          setOpen(null);
          window.history.replaceState(null, "", basePath);
        }}
      />
    );
  }

  const shared = list.filter((r) => r.shared);
  const mine = list.filter((r) => !r.shared && r.created_by === me);
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpenText size={20} className="text-mira-blue" aria-hidden /> Make a full reviewer
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-mira-muted">
          Nurse Mira reads a whole library document, about 10 pages at a time, and turns each part into a reviewer: summary, key points, terms,
          nursing implications, practice questions, flashcards and a must-remember list.{" "}
          {isAdmin
            ? "Shared reviewers appear for every student, who open them for free."
            : "Each part uses 1 of your daily AI answers. Your reviewer is private and is saved part by part, so you can continue another day."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Document</span>
            <select value={docId} onChange={(e) => setDocId(e.target.value)} className={inputClass}>
              <option value="">Choose a library document…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                  {d.page_count ? ` (${d.page_count} pages)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">From page {big ? "" : "(optional)"}</span>
            <input value={fromPage} onChange={(e) => setFromPage(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inputClass} w-28`} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">To page {big ? "" : "(optional)"}</span>
            <input value={toPage} onChange={(e) => setToPage(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inputClass} w-28`} />
          </label>
        </div>
        {big && <p className="mt-2 text-xs text-mira-muted">This is a big book — choose a chapter&apos;s page range (up to about 150 pages per reviewer).</p>}
        {isAdmin && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share with all students
          </label>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} disabled={!docId || busy} className={buttonClass("primary")}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <BookOpenText size={18} aria-hidden />}
            {busy ? "Planning…" : "Plan the reviewer"}
          </button>
          <span className="text-xs text-mira-muted">Planning is free. You&apos;ll see how many parts it needs before anything is made.</span>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
            {error}
          </p>
        )}
      </Card>

      <ReviewerList title="Shared full reviewers" items={shared} docs={docs} onOpen={openById} empty="No shared full reviewers yet." />
      {!isAdmin && <ReviewerList title="My full reviewers" items={mine} docs={docs} onOpen={openById} empty="You haven't made one yet." />}
      {isAdmin && mine.length > 0 && <ReviewerList title="My private full reviewers" items={mine} docs={docs} onOpen={openById} empty="" />}
    </div>
  );
}

function summaryOf(r: ReviewerRow): ReviewerSummary {
  return { id: r.id, document_id: r.document_id, created_by: r.created_by, shared: r.shared, title: r.title, status: r.status, created_at: r.created_at, total: r.plan.length, done: r.parts.length };
}

function ReviewerList({ title, items, onOpen, empty }: { title: string; items: ReviewerSummary[]; docs: DocOption[]; onOpen: (id: string) => void; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={empty}>Choose a document above to make one.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-mira-line hover:ring-mira-blue">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mira-muted">
                {r.status === "ready" ? <Badge tone="green">Ready · {r.total} parts</Badge> : <Badge tone="yellow">{r.done} of {r.total} parts made</Badge>}
                {r.shared && <Badge tone="blue">Shared</Badge>}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const TABS = [
  ["read", "Reviewer"],
  ["questions", "Practice questions"],
  ["flashcards", "Flashcards"],
  ["quick", "Must remember"],
] as const;

function ReviewerView({
  reviewer,
  canBuild,
  canDelete,
  onChange,
  onDeleted,
  onBack,
}: {
  reviewer: ReviewerRow;
  canBuild: boolean;
  canDelete: boolean;
  onChange: (r: ReviewerRow) => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("read");
  const [building, setBuilding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const stopRef = useRef(false);
  const parts = reviewer.parts;
  const total = reviewer.plan.length;
  const allQuestions = useMemo(() => parts.flatMap((p) => p.practice_questions), [parts]);
  const allCards = useMemo(() => parts.flatMap((p) => p.flashcards), [parts]);

  useEffect(() => () => void (stopRef.current = true), []);

  async function build() {
    if (building) return;
    stopRef.current = false;
    setBuilding(true);
    setNote(null);
    let current = reviewer;
    while (!stopRef.current && current.parts.length < current.plan.length) {
      setNote(`Making part ${current.parts.length + 1} of ${current.plan.length}… keep this page open.`);
      const r = await call({ action: "part", reviewer_id: current.id });
      if (stopRef.current) break;
      if (!r.ok) {
        if (r.kind === "busy") {
          for (let s = r.retry; s > 0 && !stopRef.current; s--) {
            setNote(`The free AI is busy — trying again in ${s} s… (keep this page open)`);
            await new Promise((res) => setTimeout(res, 1000));
          }
          continue;
        }
        setNote(r.message);
        break;
      }
      current = r.data.reviewer as ReviewerRow;
      onChange(current);
      if (r.data.done) {
        setNote("✓ Finished! Every part is ready.");
        break;
      }
    }
    if (stopRef.current && current.parts.length < current.plan.length) setNote(`Paused at ${current.parts.length} of ${current.plan.length} parts. Press Continue any time.`);
    setBuilding(false);
  }

  async function remove() {
    if (!confirm("Delete this full reviewer? This can't be undone.")) return;
    const { error } = await createClient().from("full_reviewers").delete().eq("id", reviewer.id);
    if (error) return setNote("It couldn't be deleted. Please try again.");
    onDeleted();
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline">
        <ArrowLeft size={16} aria-hidden /> All full reviewers
      </button>

      <Card>
        <p className="text-sm text-mira-muted">Full reviewer{reviewer.shared ? " · shared with all students" : " · private"}</p>
        <h1 className="text-2xl font-semibold">{reviewer.title}</h1>
        <p className="mt-2 text-xs text-mira-muted">
          {parts.length} of {total} parts made. AI-generated from the library document — check anything surprising with your instructor or the original.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-mira-page">
          <div className="h-full rounded-full bg-mira-blue transition-all" style={{ width: `${total ? Math.round((parts.length / total) * 100) : 0}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canBuild && parts.length < total && (
            <button type="button" onClick={() => (building ? (stopRef.current = true) : build())} className={buttonClass(building ? "secondary" : "primary", "!py-2")}>
              {building ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              {building ? "Pause" : parts.length ? "Continue making parts" : `Make all ${total} parts`}
            </button>
          )}
          {parts.length > 0 && (
            <button type="button" onClick={() => printReviewer(reviewer)} className={buttonClass("secondary", "!py-2")}>
              <Printer size={16} aria-hidden /> Print / save as PDF
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={remove} className={buttonClass("secondary", "!py-2")}>
              <Trash2 size={16} aria-hidden /> Delete
            </button>
          )}
        </div>
        {canBuild && parts.length < total && !building && !note && (
          <p className="mt-2 text-xs text-mira-muted">
            {reviewer.shared ? "Shared reviewers don't use students' answers." : `Each part uses 1 of your daily AI answers (${total - parts.length} parts to go).`} Each part takes about 20–60
            seconds; keep this page open while it works.
          </p>
        )}
        {!canBuild && parts.length < total && <p className="mt-2 text-xs text-mira-muted">The rest of this reviewer is still being made.</p>}
        {note && <p className="mt-3 rounded-lg bg-mira-page px-3 py-2 text-sm">{note}</p>}
      </Card>

      {parts.length > 0 && (
        <>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Full reviewer sections">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${tab === value ? "bg-mira-blue font-medium text-white" : "bg-white text-mira-muted ring-1 ring-mira-line hover:text-mira-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "read" && (
            <div className="space-y-4">
              <Card className="!p-4">
                <p className="mb-2 text-sm font-semibold">Contents</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {parts.map((p, i) => (
                    <li key={i}>
                      <a href={`#part-${i + 1}`} className="text-mira-blue hover:underline">
                        {p.title || `Part ${i + 1}`}
                      </a>
                      {pagesLabel(p.pages) && <span className="text-mira-muted"> · {pagesLabel(p.pages)}</span>}
                    </li>
                  ))}
                </ol>
              </Card>
              {parts.map((p, i) => (
                <Card key={i}>
                  <div id={`part-${i + 1}`} className="scroll-mt-20">
                    <p className="text-xs text-mira-muted">
                      Part {i + 1} of {total}
                      {pagesLabel(p.pages) ? ` · ${pagesLabel(p.pages)}` : ""}
                    </p>
                    <h2 className="text-lg font-semibold">{p.title || `Part ${i + 1}`}</h2>
                    <div className="prose-mira mt-2 text-sm leading-relaxed">
                      <Md>{p.summary}</Md>
                    </div>
                    {p.key_points.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {p.key_points.map((k, j) => (
                          <div key={j} className="rounded-xl bg-mira-page p-3">
                            <p className="font-semibold text-mira-blue-dark">{k.title}</p>
                            <div className="prose-mira mt-1 text-sm">
                              <Md>{k.explanation}</Md>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.terms.length > 0 && (
                      <>
                        <h3 className="mt-4 text-sm font-semibold">Terms</h3>
                        <dl className="mt-1 divide-y divide-mira-line">
                          {p.terms.map((t, j) => (
                            <div key={j} className="grid gap-1 py-2 sm:grid-cols-[200px_1fr]">
                              <dt className="text-sm font-semibold">{t.term}</dt>
                              <dd className="text-sm">
                                <Md inline>{t.definition}</Md>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    )}
                    {p.nursing_implications.length > 0 && (
                      <>
                        <h3 className="mt-4 text-sm font-semibold">Nursing implications</h3>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {p.nursing_implications.map((x, j) => (
                            <li key={j}>
                              <Md inline>{x}</Md>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {tab === "questions" && (allQuestions.length ? <Questions seed={reviewer.id} qs={allQuestions} /> : <EmptyState title="No practice questions yet">They appear as parts are made.</EmptyState>)}
          {tab === "flashcards" && (allCards.length ? <Flashcards cards={allCards} /> : <EmptyState title="No flashcards yet">They appear as parts are made.</EmptyState>)}
          {tab === "quick" && (
            <div className="space-y-4">
              {parts.map((p, i) => (
                <Card key={i} className="!p-4">
                  <p className="mb-2 text-sm font-semibold">{p.title || `Part ${i + 1}`}</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.quick_review.map((x, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-mira-blue">✓</span>
                        <span>
                          <Md inline>{x}</Md>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function printReviewer(r: ReviewerRow) {
  const esc = (s: string) =>
    stripCites(s)
      .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");
  const body = r.parts
    .map(
      (p, i) => `<section><h2>${i + 1}. ${esc(p.title || `Part ${i + 1}`)}${pagesLabel(p.pages) ? ` <small>(${pagesLabel(p.pages)})</small>` : ""}</h2>
<p>${esc(p.summary)}</p>
${p.key_points.map((k) => `<h3>${esc(k.title)}</h3><p>${esc(k.explanation)}</p>`).join("")}
${p.terms.length ? `<h3>Terms</h3><ul>${p.terms.map((t) => `<li><b>${esc(t.term)}</b> – ${esc(t.definition)}</li>`).join("")}</ul>` : ""}
${p.nursing_implications.length ? `<h3>Nursing implications</h3><ul>${p.nursing_implications.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<h3>Must remember</h3><ul>${p.quick_review.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>`,
    )
    .join("");
  const qs = r.parts.flatMap((p) => p.practice_questions);
  const questions = qs.length
    ? `<section class="b"><h2>Practice questions</h2><ol>${qs
        .map((q) => `<li><p>${esc(q.question)}</p><ol type="A">${q.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></li>`)
        .join("")}</ol><h2>Answer key</h2><ol>${qs.map((q) => `<li><b>${String.fromCharCode(65 + q.answer)}</b> – ${esc(q.rationale)}</li>`).join("")}</ol></section>`
    : "";
  const html = `<!doctype html><html><head><title>${esc(r.title)} – Full reviewer</title><style>
body{font-family:system-ui,Arial,sans-serif;max-width:760px;margin:24px auto;color:#111;font-size:12.5px;line-height:1.5}
h1{font-size:21px;margin:0}h2{font-size:16px;margin:22px 0 6px;border-bottom:2px solid #2148c0;color:#1b3a9a}h3{font-size:13px;margin:10px 0 2px}
p{margin:2px 0 6px}ul,ol{margin:0 0 6px;padding-left:20px}li{margin:2px 0}small{color:#666;font-weight:normal}.s{color:#555}.b{page-break-before:always}
</style></head><body><h1>${esc(r.title)}</h1><p class="s">Nurse Mira full reviewer · AI-generated from the library document — check with your instructor or the original.</p>${body}${questions}</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
