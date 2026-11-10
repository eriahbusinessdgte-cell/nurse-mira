"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb, MessageCircleHeart, Printer, RotateCcw, Shuffle } from "lucide-react";
import { buttonClass, Card } from "@/components/ui";
import { sourceLabel } from "@/lib/library/labels";
import type { SheetContent, SheetRow } from "./review-center";

const TABS = [
  ["overview", "Overview"],
  ["terms", "Terms"],
  ["nursing", "Nursing focus"],
  ["questions", "Practice questions"],
  ["flashcards", "Flashcards"],
  ["quick", "Quick review"],
] as const;
type Tab = (typeof TABS)[number][0];

const cite = (t: string) => t.replace(/\[S(\d{1,2})\]/g, "[S$1](#src-$1)");
export const stripCites = (t: string) => t.replace(/\s*\[S\d{1,2}\]/g, "");

export function Md({ children, inline = false }: { children: string; inline?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => (inline ? <>{c}</> : <p>{c}</p>),
        a: ({ href, children: c }) =>
          href?.startsWith("#src-") ? (
            <a href={href} className="mx-0.5 rounded bg-mira-blue-soft px-1.5 py-0.5 text-[11px] font-semibold text-mira-blue no-underline">
              {c}
            </a>
          ) : (
            <span>{c}</span>
          ),
      }}
    >
      {cite(children)}
    </ReactMarkdown>
  );
}

/** Same shuffle every time for the same sheet, so answers don't jump around on refresh. */
function seededOrder(n: number, seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function Questions({ seed, qs }: { seed: string; qs: SheetContent["practice_questions"] }) {
  const orders = useMemo(() => qs.map((q, i) => seededOrder(q.options.length, `${seed}-${i}`)), [qs, seed]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const score = Object.entries(picked).filter(([i, p]) => qs[Number(i)].answer === p).length;

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        AI-generated practice questions (PNLE style) — not from an official exam bank. Check anything surprising with your instructor or textbook.
      </p>
      {qs.map((q, i) => {
        const chosen = picked[i];
        const done = chosen !== undefined;
        return (
          <Card key={i} className="!p-4">
            <p className="font-medium">
              {i + 1}. <Md inline>{q.question}</Md>
            </p>
            <div className="mt-3 grid gap-2">
              {orders[i].map((optIndex, pos) => {
                const correct = optIndex === q.answer;
                const isChosen = chosen === optIndex;
                const tone = !done
                  ? "bg-white ring-mira-line hover:ring-mira-blue"
                  : correct
                    ? "bg-green-50 ring-green-400 text-green-900"
                    : isChosen
                      ? "bg-red-50 ring-red-300 text-mira-danger"
                      : "bg-white ring-mira-line opacity-70";
                return (
                  <button
                    key={optIndex}
                    type="button"
                    disabled={done}
                    onClick={() => setPicked((p) => ({ ...p, [i]: optIndex }))}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-left text-sm ring-1 ${tone}`}
                  >
                    <span className="font-semibold">{String.fromCharCode(65 + pos)}.</span>
                    <span>{stripCites(q.options[optIndex])}</span>
                  </button>
                );
              })}
            </div>
            {done && (
              <div className="mt-3 rounded-lg bg-mira-page px-3 py-2 text-sm">
                <p className="font-semibold">{chosen === q.answer ? "✓ Correct!" : `✗ The answer is ${String.fromCharCode(65 + orders[i].indexOf(q.answer))}.`}</p>
                <div className="prose-mira mt-1">
                  <Md>{q.rationale}</Md>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">
          Score: {score} / {answered} answered{answered === qs.length ? ` — ${Math.round((score / qs.length) * 100)}%` : ""}
        </p>
        {answered > 0 && (
          <button type="button" onClick={() => setPicked({})} className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <RotateCcw size={15} aria-hidden /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function Flashcards({ cards }: { cards: SheetContent["flashcards"] }) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[order[pos]];
  const go = (d: number) => {
    setFlipped(false);
    setPos((p) => (p + d + cards.length) % cards.length);
  };
  return (
    <div className="mx-auto max-w-xl">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={`flex min-h-56 w-full flex-col items-center justify-center rounded-2xl p-6 text-center shadow-sm ring-1 transition ${flipped ? "bg-mira-blue text-white ring-mira-blue" : "bg-white ring-mira-line"}`}
        aria-label={flipped ? "Show the question" : "Show the answer"}
      >
        <span className={`mb-3 text-xs uppercase tracking-wide ${flipped ? "text-white/70" : "text-mira-muted"}`}>{flipped ? "Answer" : "Question"}</span>
        <span className="text-lg font-medium">{stripCites(flipped ? card.back : card.front)}</span>
        <span className={`mt-4 text-xs ${flipped ? "text-white/70" : "text-mira-muted"}`}>Tap to flip</span>
      </button>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className={buttonClass("secondary", "!px-3")} aria-label="Previous card">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-mira-muted">
          Card {pos + 1} of {cards.length}
        </span>
        <button type="button" onClick={() => go(1)} className={buttonClass("secondary", "!px-3")} aria-label="Next card">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => {
            const next = [...order];
            for (let i = next.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [next[i], next[j]] = [next[j], next[i]];
            }
            setOrder(next);
            setPos(0);
            setFlipped(false);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline"
        >
          <Shuffle size={15} aria-hidden /> Shuffle cards
        </button>
      </div>
    </div>
  );
}

function printQuickReview(sheet: SheetRow, subjectLabel: string) {
  const esc = (s: string) => stripCites(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const c = sheet.content;
  const html = `<!doctype html><html><head><title>${esc(sheet.focus)} – Quick review</title><style>
body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:24px auto;color:#111;font-size:13px;line-height:1.45}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ddd}p.s{color:#555;margin:2px 0 12px}
ul{margin:0;padding-left:18px}li{margin:2px 0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
</style></head><body><h1>${esc(sheet.focus)}</h1><p class="s">${esc(subjectLabel)} · Nurse Mira quick review</p>
<h2>Must remember</h2><ul>${c.quick_review.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>Key terms</h2><ul>${c.terms.map((t) => `<li><b>${esc(t.term)}</b> – ${esc(t.definition)}</li>`).join("")}</ul>
${c.comparison ? `<h2>${esc(c.comparison.title)}</h2><table><tr>${c.comparison.columns.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${c.comparison.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</table>` : ""}
<h2>Nursing implications</h2><ul>${c.nursing_implications.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>Exam tips</h2><ul>${c.exam_tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<p class="s" style="margin-top:18px">For learning only. Always follow your clinical instructor and current references.</p></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function SheetView({ sheet, subjectLabel, onBack }: { sheet: SheetRow; subjectLabel: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const c = sheet.content;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline">
        <ArrowLeft size={16} aria-hidden /> Review Center
      </button>

      <Card>
        <p className="text-sm text-mira-muted">{subjectLabel}</p>
        <h1 className="text-2xl font-semibold">{sheet.focus}</h1>
        <p className="mt-2 text-xs text-mira-muted">
          {sheet.from_library ? "Made by Nurse Mira from the shared library (sources below)." : "This topic isn't in the Nurse Mira library yet, so this sheet uses general nursing knowledge."}{" "}
          AI-generated — check anything surprising with your instructor or textbook.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/tutor?ask=${encodeURIComponent(`Help me study ${sheet.focus}. Start by asking me what I already know.`)}`} className={buttonClass("accent", "!py-2")}>
            <MessageCircleHeart size={16} aria-hidden /> Ask the AI Tutor about this
          </a>
          <button type="button" onClick={() => printQuickReview(sheet, subjectLabel)} className={buttonClass("secondary", "!py-2")}>
            <Printer size={16} aria-hidden /> Print quick review
          </button>
        </div>
      </Card>

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Study sheet sections">
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

      <div role="tabpanel">
        {tab === "overview" && (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-2 font-semibold">Summary</h2>
              <div className="prose-mira text-sm leading-relaxed">
                <Md>{c.summary}</Md>
              </div>
            </Card>
            {c.key_concepts.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {c.key_concepts.map((k) => (
                  <Card key={k.title} className="!p-4">
                    <p className="font-semibold text-mira-blue-dark">{k.title}</p>
                    <div className="prose-mira mt-1 text-sm">
                      <Md>{k.explanation}</Md>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {c.comparison && (
              <Card>
                <h2 className="mb-3 font-semibold">{c.comparison.title}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {c.comparison.columns.map((h) => (
                          <th key={h} className="border border-mira-line bg-mira-page px-2 py-1.5 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.comparison.rows.map((r, i) => (
                        <tr key={i}>
                          {r.map((cell, j) => (
                            <td key={j} className="border border-mira-line px-2 py-1.5 align-top">
                              {stripCites(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "terms" && (
          <Card>
            <dl className="divide-y divide-mira-line">
              {c.terms.map((t) => (
                <div key={t.term} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
                  <dt className="font-semibold">{t.term}</dt>
                  <dd className="text-sm">
                    <Md inline>{t.definition}</Md>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {tab === "nursing" && (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-2 font-semibold">Nursing implications</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {c.nursing_implications.map((x, i) => (
                  <li key={i}>
                    <Md inline>{x}</Md>
                  </li>
                ))}
              </ul>
            </Card>
            {c.clinical_applications.length > 0 && (
              <Card>
                <h2 className="mb-2 font-semibold">Clinical applications</h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  {c.clinical_applications.map((x, i) => (
                    <li key={i}>
                      <Md inline>{x}</Md>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {tab === "questions" && <Questions seed={sheet.id} qs={c.practice_questions} />}
        {tab === "flashcards" && <Flashcards cards={c.flashcards} />}

        {tab === "quick" && (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-2 font-semibold">Must remember</h2>
              <ul className="space-y-1.5 text-sm">
                {c.quick_review.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-mira-blue">✓</span>
                    <span>
                      <Md inline>{x}</Md>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            {c.exam_tips.length > 0 && (
              <Card>
                <h2 className="mb-2 flex items-center gap-2 font-semibold">
                  <Lightbulb size={17} className="text-amber-500" aria-hidden /> Exam tips
                </h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  {c.exam_tips.map((x, i) => (
                    <li key={i}>
                      <Md inline>{x}</Md>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>

      {sheet.sources.length > 0 && (
        <Card className="!p-4">
          <p className="mb-1.5 text-xs font-semibold text-mira-muted">Sources from the Nurse Mira library</p>
          <ul className="space-y-1">
            {sheet.sources.map((s) => (
              <li key={s.n} id={`src-${s.n}`} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-mira-blue-soft px-1.5 py-0.5 font-semibold text-mira-blue">S{s.n}</span>
                <span className="font-medium">{s.title}</span>
                {s.page ? <span className="text-mira-muted">page {s.page}</span> : null}
                <span className="text-mira-muted">· {sourceLabel(s.source_type)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
