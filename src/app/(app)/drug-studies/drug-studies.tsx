"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, FileDown, Loader2, Pill, Plus, Printer, Sparkles, Trash2, X } from "lucide-react";
import { buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { findIdentifiers } from "@/lib/case/facts";
import { downloadBlob, markdownToDocx } from "@/lib/case/export-docx";
import { fromLines, toLines } from "@/lib/ncp/plan";
import { emptyStudy, normalizeStudy, studyTitle, studyToMarkdown, type DrugStudy } from "@/lib/drug/study";

export type StudyRow = { id: string; case_study_id: string | null; position: number; study: DrugStudy; ai_generated: boolean; updated_at: string };
type CaseRow = { id: string; title: string; deidentified_confirmed: boolean };

function Lines({ label, value, onChange, rows = 3 }: { label: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span> <span className="text-xs text-mira-muted">(one per line)</span>
      <textarea value={toLines(value)} onChange={(e) => onChange(fromLines(e.target.value))} rows={Math.max(rows, value.length + 1)} className={`${inputClass} mt-1`} />
    </label>
  );
}
function Field({ label, value, onChange, rows = 1, max = 1200 }: { label: string; value: string; onChange: (v: string) => void; rows?: number; max?: number }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {rows === 1 ? (
        <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} className={`${inputClass} mt-1`} />
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} rows={rows} className={`${inputClass} mt-1`} />
      )}
    </label>
  );
}

function StudyEditor({ s, onChange }: { s: DrugStudy; onChange: (s: DrugStudy) => void }) {
  const set = (patch: Partial<DrugStudy>) => onChange({ ...s, ...patch });
  const setR = (k: keyof DrugStudy["responsibilities"], v: string[]) => set({ responsibilities: { ...s.responsibilities, [k]: v } });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Generic name" value={s.generic_name} onChange={(v) => set({ generic_name: v })} max={120} />
        <Field label="Brand name(s)" value={s.brand_names} onChange={(v) => set({ brand_names: v })} max={200} />
        <Field label="Pharmacologic class" value={s.classification.pharmacologic} onChange={(v) => set({ classification: { ...s.classification, pharmacologic: v } })} max={200} />
        <Field label="Therapeutic class" value={s.classification.therapeutic} onChange={(v) => set({ classification: { ...s.classification, therapeutic: v } })} max={200} />
      </div>
      <Field label="Dosage, route and frequency (as ordered)" value={s.order} onChange={(v) => set({ order: v })} max={300} />
      <Field label="Mechanism of action" value={s.mechanism} onChange={(v) => set({ mechanism: v })} rows={3} />
      <div className="grid gap-3 md:grid-cols-2">
        <Lines label="Indications" value={s.indications} onChange={(v) => set({ indications: v })} />
        <Field label="Indication for this patient" value={s.indication_for_patient} onChange={(v) => set({ indication_for_patient: v })} rows={3} max={500} />
        <Lines label="Contraindications" value={s.contraindications} onChange={(v) => set({ contraindications: v })} />
        <Lines label="Drug interactions" value={s.interactions} onChange={(v) => set({ interactions: v })} />
        <Lines label="Side effects (common)" value={s.side_effects} onChange={(v) => set({ side_effects: v })} />
        <Lines label="Adverse effects (serious)" value={s.adverse_effects} onChange={(v) => set({ adverse_effects: v })} />
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">Nursing responsibilities</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Lines label="Before" value={s.responsibilities.before} onChange={(v) => setR("before", v)} rows={4} />
          <Lines label="During" value={s.responsibilities.during} onChange={(v) => setR("during", v)} rows={4} />
          <Lines label="After" value={s.responsibilities.after} onChange={(v) => setR("after", v)} rows={4} />
        </div>
      </section>
      <Lines label="Patient / family teaching" value={s.teaching} onChange={(v) => set({ teaching: v })} />
    </div>
  );
}

export function DrugStudies({
  studies: initial,
  cases,
  remaining: initialRemaining,
  initialCase = null,
}: {
  studies: StudyRow[];
  cases: CaseRow[];
  remaining: number;
  initialCase?: string | null;
}) {
  const [studies, setStudies] = useState(initial);
  const [group, setGroup] = useState(initialCase ?? "all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [lines, setLines] = useState("");
  const [context, setContext] = useState<"none" | "case" | "typed">(initialCase ? "case" : "none");
  const [caseId, setCaseId] = useState(initialCase ?? cases[0]?.id ?? "");
  const [typed, setTyped] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const drugs = lines.split("\n").map((l) => l.trim()).filter((l) => l.length >= 3).slice(0, 10);
  const warnings = findIdentifiers(`${lines}\n${context === "typed" ? typed : ""}`);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const shown = studies
    .filter((p) => group === "all" || (group === "none" ? !p.case_study_id : p.case_study_id === group))
    .sort((a, b) => (a.case_study_id ?? "").localeCompare(b.case_study_id ?? "") || a.position - b.position);

  function save(id: string, patch: Partial<Pick<StudyRow, "study" | "case_study_id" | "position">>, delay = 900) {
    setStudies((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaving((s) => ({ ...s, [id]: "saving" }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error } = await createClient().from("drug_studies").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      setSaving((s) => ({ ...s, [id]: error ? "error" : "saved" }));
    }, delay);
  }

  async function reload(openIds: string[] = []) {
    const { data } = await createClient().from("drug_studies").select("id, case_study_id, position, study, ai_generated, updated_at").order("position").limit(500);
    if (data) {
      setStudies((data as StudyRow[]).map((p) => ({ ...p, study: normalizeStudy(p.study) })));
      setOpen((o) => ({ ...o, ...Object.fromEntries(openIds.map((id) => [id, true])) }));
    }
  }

  async function generate() {
    setMessage(null);
    if (!drugs.length) return setMessage({ ok: false, text: "Type at least one drug (one per line)." });
    if (warnings.length) return setMessage({ ok: false, text: "Remove the identifying details first." });
    if (context === "case" && !caseById.get(caseId)?.deidentified_confirmed)
      return setMessage({ ok: false, text: "Open that case study and tick the de-identification confirmation in “Case information” first." });
    const made: string[] = [];
    const failed: string[] = [];
    let stop = "";
    for (let i = 0; i < drugs.length; i++) {
      setProgress(`Making drug study ${i + 1} of ${drugs.length}: ${drugs[i]}…`);
      let tries = 0;
      while (true) {
        const { data, error } = await createClient().functions.invoke("drug-study", {
          body: { line: drugs[i], case_id: context === "case" ? caseId : null, patient_text: context === "typed" ? typed : null },
        });
        if (!error && data && !data.error) {
          made.push(data.id as string);
          if (typeof data.remaining === "number") setRemaining(data.remaining);
          break;
        }
        let text = data?.error as string | undefined;
        if (!text && error) {
          try {
            text = (await (error as { context?: Response }).context?.json())?.error;
          } catch {
            /* ignore */
          }
        }
        if (data?.kind === "busy" && tries < 3) {
          tries++;
          for (let s = 40; s > 0; s--) {
            setProgress(`The free AI is busy — trying “${drugs[i]}” again in ${s} s…`);
            await new Promise((r) => setTimeout(r, 1000));
          }
          continue;
        }
        if (data?.kind === "limit") stop = text ?? "";
        else {
          if (data?.kind !== "invalid") reportProblem("drug-study", problemKind(data, !!error), text);
          failed.push(`${drugs[i]}: ${text ?? "couldn't be made"}`);
        }
        break;
      }
      if (stop) break;
    }
    setProgress(null);
    if (made.length) {
      setGroup(context === "case" ? caseId : "all");
      await reload(made.slice(0, 1));
      setLines("");
    }
    const parts = [made.length ? `${made.length} drug stud${made.length === 1 ? "y" : "ies"} added — check each one against a current drug reference and edit freely.` : "", ...failed, stop];
    setMessage({ ok: made.length > 0 && !failed.length && !stop, text: parts.filter(Boolean).join(" ") });
  }

  async function addBlank() {
    const linked = group !== "all" && group !== "none" ? group : null;
    const pos = Math.max(-1, ...studies.filter((p) => p.case_study_id === linked).map((p) => p.position)) + 1;
    const user = (await createClient().auth.getSession()).data.session?.user;
    const { data } = await createClient().from("drug_studies").insert({ student_id: user?.id, case_study_id: linked, position: pos, study: emptyStudy() }).select("id").single();
    if (data) await reload([data.id as string]);
  }

  async function duplicate(p: StudyRow) {
    const pos = Math.max(...studies.filter((x) => x.case_study_id === p.case_study_id).map((x) => x.position)) + 1;
    const user = (await createClient().auth.getSession()).data.session?.user;
    const { data } = await createClient().from("drug_studies").insert({ student_id: user?.id, case_study_id: p.case_study_id, position: pos, study: p.study }).select("id").single();
    if (data) await reload([data.id as string]);
  }

  async function remove(p: StudyRow) {
    if (!confirm(`Delete the drug study “${studyTitle(p.study)}”?`)) return;
    const { error } = await createClient().from("drug_studies").delete().eq("id", p.id);
    if (!error) setStudies((l) => l.filter((x) => x.id !== p.id));
  }

  function move(p: StudyRow, d: number) {
    const siblings = shown.filter((x) => x.case_study_id === p.case_study_id);
    const other = siblings[siblings.findIndex((x) => x.id === p.id) + d];
    if (!other) return;
    save(p.id, { position: other.position }, 0);
    save(other.id, { position: p.position }, 0);
  }

  async function exportWord() {
    const title = group !== "all" && group !== "none" ? `Drug Study – ${caseById.get(group)?.title ?? ""}` : "Drug Study";
    const blob = await markdownToDocx(title, "Prepared with Nurse Mira · check against a current drug reference and with your clinical instructor", shown.map((p) => ({ title: studyTitle(p.study), content: studyToMarkdown(p.study) })));
    downloadBlob(blob, `${title.replace(/[^\w\- ]+/g, "").trim() || "drug-study"}.docx`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
            <Pill size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">Drug Study Maker</h1>
            <p className="mt-1 text-sm text-mira-muted">
              Type each drug with its order, one per line — Nurse Mira fills in the classification, mechanism of action, indications, contraindications, side and adverse
              effects, interactions, nursing responsibilities (before, during, after) and teaching, using the Pharmacology textbook in the library when it covers the drug.
              Doses are never added or changed: only what you type from the order is used.
            </p>
          </div>
        </div>

        <label className="mt-5 block text-sm">
          <span className="font-medium">Drugs and their orders</span>
          <span className="block text-xs text-mira-muted">One per line, e.g. “Ceftriaxone 1 g IV q12h” or “Paracetamol 500 mg 1 tab PO q4h PRN for fever”. Up to 10 at a time.</span>
          <textarea value={lines} onChange={(e) => setLines(e.target.value.slice(0, 3000))} rows={4} className={`${inputClass} mt-1`} />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Patient (optional — adds “indication for this patient”)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["none", "No patient"],
                ["case", cases.length ? "One of my case studies" : "One of my case studies (none yet)"],
                ["typed", "Type the condition"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${context === v ? "bg-mira-blue-soft ring-mira-blue" : "ring-mira-line"} ${v === "case" && !cases.length ? "opacity-60" : "cursor-pointer"}`}>
                <input type="radio" name="drug-context" disabled={v === "case" && !cases.length} checked={context === v} onChange={() => setContext(v)} className="accent-mira-blue" />
                {label}
              </label>
            ))}
          </div>
          {context === "case" && (
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={`${inputClass} mt-2`} aria-label="Case study">
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.deidentified_confirmed ? "" : " (de-identification not confirmed yet)"}
                </option>
              ))}
            </select>
          )}
          {context === "typed" && (
            <input value={typed} onChange={(e) => setTyped(e.target.value.slice(0, 600))} placeholder="e.g. 68-year-old with community-acquired pneumonia and hypertension" className={`${inputClass} mt-2`} aria-label="Patient condition" />
          )}
        </fieldset>
        {warnings.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-mira-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {warnings.join(" ")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={generate} disabled={!!progress || !drugs.length} className={buttonClass("accent")}>
            {progress ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
            {drugs.length > 1 ? `Make ${drugs.length} drug studies` : "Make drug study"}
          </button>
          <span className="text-xs text-mira-muted">Each drug uses 1 AI answer ({remaining} left today). Rewrite in your own words and follow your instructor&apos;s rules on AI.</span>
        </div>
        {progress && <p className="mt-3 rounded-lg bg-mira-page px-3 py-2 text-sm">{progress}</p>}
      </Card>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-950"}`}>
          <span className="flex-1">{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">My drug studies</h2>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Show drug studies for">
            <option value="all">All</option>
            <option value="none">Not linked to a case study</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                Case: {c.title}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <button type="button" onClick={addBlank} className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <Plus size={16} aria-hidden /> Blank
          </button>
          <button type="button" onClick={exportWord} disabled={!shown.length} className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <FileDown size={16} aria-hidden /> Word
          </button>
          <a href={`/print/drug?group=${group}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <Printer size={16} aria-hidden /> Print / PDF
          </a>
        </div>

        {shown.length === 0 ? (
          <EmptyState title="No drug studies here yet">Type your drugs above, or add a blank one to write yourself.</EmptyState>
        ) : (
          shown.map((p, i) => {
            const siblings = shown.filter((x) => x.case_study_id === p.case_study_id);
            const si = siblings.findIndex((x) => x.id === p.id);
            const isOpen = !!open[p.id];
            return (
              <Card key={p.id} className="!p-0">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [p.id]: !isOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                    <span className="text-sm font-semibold text-mira-muted">{i + 1}.</span>
                    <span className="truncate font-medium">{studyTitle(p.study)}</span>
                    {p.study.order && <span className="hidden truncate text-sm text-mira-muted sm:inline">· {p.study.order}</span>}
                  </button>
                  {group === "all" && <span className="text-xs text-mira-muted">{p.case_study_id ? caseById.get(p.case_study_id)?.title : ""}</span>}
                  <span className="text-xs text-mira-muted">{saving[p.id] === "saving" ? "Saving…" : saving[p.id] === "error" ? "Not saved" : ""}</span>
                  <button type="button" onClick={() => move(p, -1)} disabled={si === 0} className="rounded p-1.5 text-mira-muted hover:bg-mira-page disabled:opacity-30" aria-label="Move up">
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" onClick={() => move(p, 1)} disabled={si === siblings.length - 1} className="rounded p-1.5 text-mira-muted hover:bg-mira-page disabled:opacity-30" aria-label="Move down">
                    <ArrowDown size={16} />
                  </button>
                  <button type="button" onClick={() => duplicate(p)} className="rounded p-1.5 text-mira-muted hover:bg-mira-page" aria-label="Duplicate" title="Duplicate">
                    <Copy size={16} />
                  </button>
                  <button type="button" onClick={() => remove(p)} className="rounded p-1.5 text-mira-muted hover:bg-red-50 hover:text-mira-danger" aria-label="Delete" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-mira-line px-4 py-4">
                    <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">Linked case study</span>
                      <select value={p.case_study_id ?? ""} onChange={(e) => save(p.id, { case_study_id: e.target.value || null }, 0)} className={`${inputClass} !w-auto`}>
                        <option value="">Not linked</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      {p.ai_generated && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">AI draft — check against a current drug reference</span>}
                    </label>
                    <StudyEditor s={p.study} onChange={(study) => save(p.id, { study })} />
                  </div>
                )}
              </Card>
            );
          })
        )}
        <p className="text-xs text-mira-muted">Drug studies are a learning aid. Always verify drugs and doses against a current drug reference, the physician&apos;s order and your clinical instructor.</p>
      </section>
    </div>
  );
}
