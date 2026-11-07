"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileDown,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { buttonClass, Card, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { downloadBlob, markdownToDocx } from "@/lib/case/export-docx";
import { FACT_FIELDS, findIdentifiers, headingsFromTemplate, missingCount, newSectionId, type Facts, type Section } from "@/lib/case/facts";

type Initial = { id: string; title: string; subject_id: string | null; facts: Facts; sections: Section[]; deidentified_confirmed: boolean };
type Subject = { id: string; code: string; title: string; sort_order: number };

/** Markdown with [MISSING: …] highlighted. */
function Preview({ text }: { text: string }) {
  const marked = text.replace(/\[MISSING([^\]]*)\]/gi, "**⚠ MISSING$1**");
  return (
    <div className="prose-mira text-sm leading-relaxed [&_strong:has(+*)]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({ children }) => {
            const s = String(children);
            return s.startsWith("⚠ MISSING") ? <mark className="rounded bg-amber-100 px-1 font-medium text-amber-900">{s}</mark> : <strong>{children}</strong>;
          },
        }}
      >
        {marked.replace(/\s*\[S(\d{1,2})\]/g, " (S$1)")}
      </ReactMarkdown>
    </div>
  );
}

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(900, el.scrollHeight + 2)}px`;
  }, [props.value]);
  return <textarea ref={ref} {...props} />;
}

export function CaseEditor({ initial, subjects, mySubjectIds }: { initial: Initial; subjects: Subject[]; mySubjectIds: string[] }) {
  const [title, setTitle] = useState(initial.title);
  const [subjectId, setSubjectId] = useState(initial.subject_id ?? "");
  const [facts, setFacts] = useState<Facts>(initial.facts);
  const [sections, setSections] = useState<Section[]>(initial.sections);
  const [confirmed, setConfirmed] = useState(initial.deidentified_confirmed);
  const [tab, setTab] = useState<"info" | "sections">(Object.values(initial.facts).join("").trim() ? "sections" : "info");
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const [drafting, setDrafting] = useState<string | null>(null); // "all" or a section id
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateHeadings, setTemplateHeadings] = useState<string[]>([]);
  const [templateText, setTemplateText] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const first = useRef(true);

  // Autosave 1.2 seconds after the last change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave("saving");
    const t = setTimeout(async () => {
      const { error } = await createClient()
        .from("case_studies")
        .update({ title: title.trim() || "Untitled case study", subject_id: subjectId || null, facts, sections, deidentified_confirmed: confirmed })
        .eq("id", initial.id);
      setSave(error ? "error" : "saved");
    }, 1200);
    return () => clearTimeout(t);
  }, [title, subjectId, facts, sections, confirmed, initial.id]);

  const allFactsText = Object.values(facts).join("\n");
  const warnings = findIdentifiers(allFactsText);
  const factsFilled = allFactsText.trim().length >= 40;
  const missing = missingCount(sections);
  const sortedSubjects = [...subjects].sort((a, b) => Number(mySubjectIds.includes(b.id)) - Number(mySubjectIds.includes(a.id)) || a.sort_order - b.sort_order);
  const subject = subjects.find((s) => s.id === subjectId);

  const update = (id: string, patch: Partial<Section>) => setSections((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) =>
    setSections((l) => {
      const n = [...l];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x);
      return n;
    });

  async function draft(sectionIds: string[] | null) {
    if (!confirmed || warnings.length) {
      setTab("info");
      setMessage({ ok: false, text: "Before using the AI, remove any identifying details and tick the confirmation box in Case information." });
      return;
    }
    const targets = sectionIds ?? sections.filter((s) => !s.content.trim()).map((s) => s.id);
    if (!targets.length) {
      setMessage({ ok: false, text: "Every section already has text. Use “Draft” on a single section to redo it." });
      return;
    }
    const overwrite = sections.filter((s) => targets.includes(s.id) && s.content.trim());
    if (overwrite.length && !confirm(`Replace your current text in “${overwrite.map((s) => s.title).join("”, “")}” with a new AI draft? Your facts are kept, but your wording will change.`)) return;

    setDrafting(sectionIds?.length === 1 ? sectionIds[0] : "all");
    setMessage(null);
    // Make sure the server has the latest facts and sections before drafting.
    await createClient()
      .from("case_studies")
      .update({ title: title.trim() || "Untitled case study", subject_id: subjectId || null, facts, sections, deidentified_confirmed: confirmed })
      .eq("id", initial.id);
    const { data, error } = await createClient().functions.invoke("case-draft", { body: { case_id: initial.id, section_ids: targets } });
    setDrafting(null);
    if (error || !data || data.error) {
      let text = data?.error as string | undefined;
      if (!text && error) {
        try {
          text = (await (error as { context?: Response }).context?.json())?.error;
        } catch {
          /* ignore */
        }
      }
      reportProblem("case-draft", problemKind(data, !!error), text);
      setMessage({ ok: false, text: text ?? "The draft couldn't be made. Please try again." });
      return;
    }
    const drafts = data.drafts as { id: string; content: string }[];
    setSections((l) => l.map((s) => drafts.find((d) => d.id === s.id) ? { ...s, content: drafts.find((d) => d.id === s.id)!.content } : s));
    setPreview((p) => ({ ...p, ...Object.fromEntries(drafts.map((d) => [d.id, true])) }));
    const srcs = (data.sources ?? []) as { n: number; title: string; page: number | null }[];
    setMessage({
      ok: true,
      text: `Drafted ${drafts.length} section${drafts.length === 1 ? "" : "s"}. Please read and edit them — fill in anything marked MISSING. Drafts are a starting point: rewrite them in your own words and follow your instructor's rules on AI.${srcs.length ? ` Background used: ${[...new Set(srcs.map((s) => s.title))].join(", ")}.` : ""}`,
    });
  }

  async function readTemplate(file: File) {
    setTemplateBusy(true);
    try {
      const { extractText } = await import("@/lib/library/extract");
      const extracted = await extractText(file);
      const text = extracted.pages.map((p) => p.text).join("\n");
      setTemplateText(text.slice(0, 20000));
      setTemplateHeadings(headingsFromTemplate(text));
    } catch {
      setMessage({ ok: false, text: "That template couldn't be read. Try a Word (.docx), PDF or text file, or type the headings instead." });
    }
    setTemplateBusy(false);
  }

  function applyTemplate(headings: string[]) {
    const clean = headings.map((h) => h.trim()).filter(Boolean);
    if (!clean.length) return;
    setSections((old) =>
      clean.map((t) => {
        const keep = old.find((s) => s.title.toLowerCase() === t.toLowerCase());
        return keep ?? { id: newSectionId(), title: t, content: "" };
      }),
    );
    setTemplateOpen(false);
    setMessage({ ok: true, text: `Your case study now follows your school's format (${clean.length} sections). Text in sections with the same name was kept.` });
  }

  async function exportWord() {
    const blob = await markdownToDocx(title, `${subject ? `${subject.title} · ` : ""}Nursing case study`, sections.map((s) => ({ title: s.title, content: s.content })));
    downloadBlob(blob, `${(title || "case-study").replace(/[^\w\- ]+/g, "").trim() || "case-study"}.docx`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/case-studies" className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline">
          <ArrowLeft size={16} aria-hidden /> Case studies
        </Link>
        <span className="flex-1" />
        <span className={`text-xs ${save === "error" ? "text-mira-danger" : "text-mira-muted"}`} role="status">
          {save === "saving" ? "Saving…" : save === "error" ? "Not saved — check your internet" : "✓ Saved"}
        </span>
        <button type="button" onClick={exportWord} className={buttonClass("secondary", "!px-3 !py-1.5")}>
          <FileDown size={16} aria-hidden /> Word
        </button>
        <a href={`/print/case/${initial.id}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "!px-3 !py-1.5")}>
          <Printer size={16} aria-hidden /> Print / PDF
        </a>
      </div>

      <Card>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 160))}
          className="w-full rounded-lg border border-transparent px-1 text-2xl font-semibold outline-none hover:border-mira-line focus:border-mira-blue"
          aria-label="Case study title"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Subject">
            <option value="">No subject</option>
            {sortedSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.code})
              </option>
            ))}
          </select>
          <span className="text-mira-muted">
            {sections.filter((s) => s.content.trim()).length}/{sections.length} sections written
          </span>
          {missing > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
              {missing} missing item{missing === 1 ? "" : "s"} to fill in
            </span>
          )}
        </div>
      </Card>

      <div className="flex gap-1" role="tablist">
        {(
          [
            ["info", "1. Case information"],
            ["sections", "2. Case study sections"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`rounded-lg px-4 py-2 text-sm ${tab === v ? "bg-mira-blue font-medium text-white" : "bg-white text-mira-muted ring-1 ring-mira-line"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-mira-danger"}`}>
          <span className="flex-1">{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </p>
      )}

      {tab === "info" && (
        <Card className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg bg-mira-blue-soft px-3 py-2 text-sm text-mira-blue-dark">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden />
            Enter only what you actually observed or were given. Leave a box empty if you don&apos;t have it — Nurse Mira will mark it as missing instead of making
            something up. Never include names, hospital or record numbers, addresses, phone numbers or exact birthdates.
          </p>
          {FACT_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="font-medium">{f.label}</span>
              <span className="block text-xs text-mira-muted">{f.hint}</span>
              <AutoTextarea
                value={facts[f.key] ?? ""}
                onChange={(e) => setFacts((x) => ({ ...x, [f.key]: e.target.value.slice(0, 4000) }))}
                rows={2}
                className={`${inputClass} mt-1 resize-none`}
              />
            </label>
          ))}
          {warnings.length > 0 && (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={16} aria-hidden /> This may identify a real patient — please remove:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-mira-blue" />
            I&apos;ve removed names and anything else that could identify the patient (de-identified).
          </label>
          <button type="button" onClick={() => setTab("sections")} className={buttonClass("primary")}>
            Next: case study sections
          </button>
        </Card>
      )}

      {tab === "sections" && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-2 !p-4">
            <button
              type="button"
              disabled={!!drafting || !factsFilled}
              onClick={() => draft(null)}
              className={buttonClass("accent")}
              title={factsFilled ? "" : "Fill in the case information first"}
            >
              {drafting === "all" ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Sparkles size={17} aria-hidden />}
              {drafting === "all" ? "Drafting… (about 20 seconds)" : "Draft empty sections with AI"}
            </button>
            <button type="button" onClick={() => setSections((l) => [...l, { id: newSectionId(), title: "New section", content: "" }])} className={buttonClass("secondary")}>
              <Plus size={17} aria-hidden /> Add section
            </button>
            <button type="button" onClick={() => setTemplateOpen(true)} className={buttonClass("secondary")}>
              <FileUp size={17} aria-hidden /> Use my school&apos;s format
            </button>
            <span className="text-xs text-mira-muted">{factsFilled ? "Drafting uses 1 AI answer." : "Fill in the case information first to use the AI."}</span>
          </Card>

          {sections.map((s, i) => (
            <Card key={s.id} className="!p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-mira-muted">{i + 1}.</span>
                <input
                  value={s.title}
                  onChange={(e) => update(s.id, { title: e.target.value.slice(0, 120) })}
                  className="min-w-[12rem] flex-1 rounded-lg border border-transparent px-1 py-0.5 font-semibold outline-none hover:border-mira-line focus:border-mira-blue"
                  aria-label={`Section ${i + 1} title`}
                />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-mira-muted hover:bg-mira-page disabled:opacity-30" aria-label="Move up">
                  <ArrowUp size={16} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="rounded p-1.5 text-mira-muted hover:bg-mira-page disabled:opacity-30" aria-label="Move down">
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreview((p) => ({ ...p, [s.id]: !p[s.id] }))}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-mira-muted hover:bg-mira-page"
                >
                  {preview[s.id] ? <Pencil size={14} aria-hidden /> : <Eye size={14} aria-hidden />} {preview[s.id] ? "Edit" : "Preview"}
                </button>
                <button
                  type="button"
                  disabled={!!drafting || !factsFilled}
                  onClick={() => draft([s.id])}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-mira-blue hover:bg-mira-blue-soft disabled:opacity-40"
                >
                  {drafting === s.id ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />} Draft
                </button>
                <button
                  type="button"
                  onClick={() => (!s.content.trim() || confirm(`Remove the section “${s.title}” and its text?`)) && setSections((l) => l.filter((x) => x.id !== s.id))}
                  className="rounded p-1.5 text-mira-muted hover:bg-red-50 hover:text-mira-danger"
                  aria-label={`Remove ${s.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2">
                {preview[s.id] && s.content.trim() ? (
                  <div className="rounded-lg bg-mira-page px-3 py-2">
                    <Preview text={s.content} />
                  </div>
                ) : (
                  <AutoTextarea
                    value={s.content}
                    onChange={(e) => update(s.id, { content: e.target.value.slice(0, 20000) })}
                    rows={4}
                    placeholder="Write this section, or press “Draft” to let Nurse Mira start it from your case information."
                    className={`${inputClass} resize-none font-mono text-[13px] leading-relaxed`}
                  />
                )}
              </div>
              {/nursing care plan/i.test(s.title) && (
                <Link href={`/care-plans?case=${initial.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-mira-blue hover:underline">
                  <ClipboardList size={15} aria-hidden /> Open the NCP Builder for this case — make and link the full care plans
                </Link>
              )}
            </Card>
          ))}
          {missing === 0 && sections.every((s) => s.content.trim()) && (
            <p className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 size={17} aria-hidden /> Every section has text and nothing is marked missing. Remember to check it with your clinical instructor.
            </p>
          )}
        </div>
      )}

      {templateOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Use my school's format">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center">
              <h2 className="flex-1 text-lg font-semibold">Use my school&apos;s format</h2>
              <button type="button" onClick={() => setTemplateOpen(false)} aria-label="Close" className="rounded p-1 text-mira-muted">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-mira-muted">Upload your school&apos;s case-study template (Word, PDF or text), or type the section headings — one per line.</p>
            <label className={buttonClass("secondary", "mt-3 cursor-pointer")}>
              {templateBusy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <FileUp size={17} aria-hidden />} Upload template
              <input type="file" accept=".docx,.pdf,.txt" className="sr-only" onChange={(e) => e.target.files?.[0] && readTemplate(e.target.files[0])} />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Section headings (one per line)
              <textarea
                value={templateHeadings.join("\n")}
                onChange={(e) => setTemplateHeadings(e.target.value.split("\n"))}
                rows={10}
                className={`${inputClass} mt-1`}
                placeholder={"Introduction\nPatient's Profile\nAnatomy and Physiology\nPathophysiology\n…"}
              />
            </label>
            {templateText && templateHeadings.length === 0 && <p className="mt-1 text-xs text-mira-muted">No headings were recognised in the file — please type them.</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => applyTemplate(templateHeadings)} disabled={!templateHeadings.some((h) => h.trim())} className={buttonClass("primary")}>
                Use these sections
              </button>
              <button type="button" onClick={() => setTemplateOpen(false)} className={buttonClass("secondary")}>
                Cancel
              </button>
            </div>
            <p className="mt-3 text-xs text-mira-muted">Sections with the same name keep their text. Sections not in the new list are removed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
