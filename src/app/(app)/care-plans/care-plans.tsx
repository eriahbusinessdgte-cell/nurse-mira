"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, ClipboardList, Copy, FileDown, Loader2, Plus, Printer, Sparkles, Trash2, X } from "lucide-react";
import { buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { findIdentifiers } from "@/lib/case/facts";
import { downloadBlob, markdownToDocx } from "@/lib/case/export-docx";
import { emptyPlan, fromLines, planTitle, planToMarkdown, toLines, type Intervention, type Plan } from "@/lib/ncp/plan";

export type PlanRow = { id: string; case_study_id: string | null; position: number; plan: Plan; ai_generated: boolean; updated_at: string };
type CaseRow = { id: string; title: string; deidentified_confirmed: boolean };

function Lines({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="block text-xs text-mira-muted">{hint}</span>}
      <textarea value={toLines(value)} onChange={(e) => onChange(fromLines(e.target.value))} rows={Math.max(rows, value.length + 1)} className={`${inputClass} mt-1`} />
    </label>
  );
}

function PlanEditor({ plan, onChange }: { plan: Plan; onChange: (p: Plan) => void }) {
  const set = (patch: Partial<Plan>) => onChange({ ...plan, ...patch });
  const setI = (i: number, patch: Partial<Intervention>) => set({ interventions: plan.interventions.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">1. Assessment</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Lines label="Subjective cues" hint="What the patient said (one per line)" value={plan.assessment.subjective} onChange={(v) => set({ assessment: { ...plan.assessment, subjective: v } })} />
          <Lines label="Objective cues" hint="What you observed or measured (one per line)" value={plan.assessment.objective} onChange={(v) => set({ assessment: { ...plan.assessment, objective: v } })} />
        </div>
        <div className="mt-3">
          <Lines label="Still to assess" hint="Possible findings that weren't in your data — check these before using them as cues" value={plan.to_assess} onChange={(v) => set({ to_assess: v })} rows={2} />
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">2. Nursing diagnosis</h3>
        <textarea value={plan.diagnosis} onChange={(e) => set({ diagnosis: e.target.value.slice(0, 400) })} rows={2} className={inputClass} placeholder="Problem related to … as evidenced by …" aria-label="Nursing diagnosis" />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">3. Outcomes</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Lines label="Short-term" value={plan.outcomes.short_term} onChange={(v) => set({ outcomes: { ...plan.outcomes, short_term: v } })} rows={2} />
          <Lines label="Long-term" value={plan.outcomes.long_term} onChange={(v) => set({ outcomes: { ...plan.outcomes, long_term: v } })} rows={2} />
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">4. Planning</h3>
        <textarea value={plan.planning} onChange={(e) => set({ planning: e.target.value.slice(0, 1500) })} rows={2} className={inputClass} aria-label="Planning" />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">5–6. Nursing interventions and rationale</h3>
        <div className="space-y-2">
          {plan.interventions.map((iv, i) => (
            <div key={i} className="grid gap-2 rounded-lg bg-mira-page p-2 md:grid-cols-[1fr_1fr_auto]">
              <textarea value={iv.action} onChange={(e) => setI(i, { action: e.target.value.slice(0, 500) })} rows={2} className={`${inputClass} bg-white`} placeholder={`Intervention ${i + 1}`} aria-label={`Intervention ${i + 1}`} />
              <textarea value={iv.rationale} onChange={(e) => setI(i, { rationale: e.target.value.slice(0, 700) })} rows={2} className={`${inputClass} bg-white`} placeholder="Rationale" aria-label={`Rationale ${i + 1}`} />
              <div className="flex items-start gap-1 md:flex-col">
                <select value={iv.kind} onChange={(e) => setI(i, { kind: e.target.value as Intervention["kind"] })} className="rounded-lg border border-mira-line bg-white px-2 py-1.5 text-xs" aria-label="Type">
                  <option value="independent">Independent</option>
                  <option value="dependent">Dependent</option>
                  <option value="collaborative">Collaborative</option>
                </select>
                <button type="button" onClick={() => set({ interventions: plan.interventions.filter((_, n) => n !== i) })} className="rounded p-1.5 text-mira-muted hover:text-mira-danger" aria-label="Remove intervention">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => set({ interventions: [...plan.interventions, { action: "", rationale: "", kind: "independent" }] })} className="inline-flex items-center gap-1 text-sm text-mira-blue hover:underline">
            <Plus size={15} aria-hidden /> Add intervention
          </button>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mira-blue">7. Evaluation</h3>
        <textarea value={plan.evaluation} onChange={(e) => set({ evaluation: e.target.value.slice(0, 1200) })} rows={2} className={inputClass} placeholder="Goal met / partially met / not met — based on what actually happened" aria-label="Evaluation" />
      </section>
    </div>
  );
}

export function CarePlans({ plans: initialPlans, cases, initialGroup, remaining: initialRemaining }: { plans: PlanRow[]; cases: CaseRow[]; initialGroup: string; remaining: number }) {
  const [plans, setPlans] = useState(initialPlans);
  const [group, setGroup] = useState(initialGroup); // "all" | "none" | case id
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [source, setSource] = useState<"case" | "typed">(cases.length ? "case" : "typed");
  const [genCase, setGenCase] = useState(initialGroup !== "all" && initialGroup !== "none" ? initialGroup : cases[0]?.id ?? "");
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState(3);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const typedWarnings = source === "typed" ? findIdentifiers(typed) : [];

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const shown = plans
    .filter((p) => group === "all" || (group === "none" ? !p.case_study_id : p.case_study_id === group))
    .sort((a, b) => (a.case_study_id ?? "").localeCompare(b.case_study_id ?? "") || a.position - b.position);

  function save(id: string, patch: Partial<Pick<PlanRow, "plan" | "case_study_id" | "position">>, delay = 900) {
    setPlans((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaving((s) => ({ ...s, [id]: "saving" }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error } = await createClient().from("care_plans").update(patch).eq("id", id);
      setSaving((s) => ({ ...s, [id]: error ? "error" : "saved" }));
    }, delay);
  }

  async function reload(openIds: string[] = []) {
    const { data } = await createClient().from("care_plans").select("id, case_study_id, position, plan, ai_generated, updated_at").order("position").limit(300);
    if (data) {
      const { normalizePlan } = await import("@/lib/ncp/plan");
      setPlans((data as PlanRow[]).map((p) => ({ ...p, plan: normalizePlan(p.plan) })));
      setOpen((o) => ({ ...o, ...Object.fromEntries(openIds.map((id) => [id, true])) }));
    }
  }

  async function generate() {
    setMessage(null);
    if (source === "case" && !genCase) return setMessage({ ok: false, text: "Choose a case study first." });
    if (source === "case" && !caseById.get(genCase)?.deidentified_confirmed)
      return setMessage({ ok: false, text: "Open that case study and tick the de-identification confirmation in “Case information” first." });
    if (source === "typed" && (typed.trim().length < 30 || typedWarnings.length)) return setMessage({ ok: false, text: "Add the patient's assessment data (without names or identifying details) first." });
    setBusy(true);
    const { data, error } = await createClient().functions.invoke("ncp", {
      body: { case_id: source === "case" ? genCase : null, assessment_text: source === "typed" ? typed : null, count, focus: focus.trim() || null },
    });
    setBusy(false);
    if (error || !data || data.error) {
      let text = data?.error as string | undefined;
      if (!text && error) {
        try {
          text = (await (error as { context?: Response }).context?.json())?.error;
        } catch {
          /* ignore */
        }
      }
      return setMessage({ ok: false, text: text ?? "The care plans couldn't be made. Please try again." });
    }
    if (typeof data.remaining === "number") setRemaining(data.remaining);
    setGroup(source === "case" ? genCase : "none");
    await reload((data.ids as string[]).slice(0, 1));
    setMessage({ ok: true, text: `${data.created} care plan${data.created === 1 ? "" : "s"} added. Read each one, check every cue against your own assessment, and edit freely.` });
  }

  async function addBlank() {
    const caseId = group !== "all" && group !== "none" ? group : null;
    const pos = Math.max(-1, ...plans.filter((p) => p.case_study_id === caseId).map((p) => p.position)) + 1;
    const user = (await createClient().auth.getSession()).data.session?.user;
    const { data } = await createClient().from("care_plans").insert({ student_id: user?.id, case_study_id: caseId, position: pos, plan: emptyPlan() }).select("id").single();
    if (data) await reload([data.id as string]);
  }

  async function duplicate(p: PlanRow) {
    const pos = Math.max(...plans.filter((x) => x.case_study_id === p.case_study_id).map((x) => x.position)) + 1;
    const user = (await createClient().auth.getSession()).data.session?.user;
    const { data } = await createClient()
      .from("care_plans")
      .insert({ student_id: user?.id, case_study_id: p.case_study_id, position: pos, plan: { ...p.plan, diagnosis: `${p.plan.diagnosis} (copy)` } })
      .select("id")
      .single();
    if (data) await reload([data.id as string]);
  }

  async function remove(p: PlanRow) {
    if (!confirm(`Delete the care plan “${planTitle(p.plan)}”?`)) return;
    const { error } = await createClient().from("care_plans").delete().eq("id", p.id);
    if (!error) setPlans((l) => l.filter((x) => x.id !== p.id));
  }

  function move(p: PlanRow, d: number) {
    const siblings = shown.filter((x) => x.case_study_id === p.case_study_id);
    const i = siblings.findIndex((x) => x.id === p.id);
    const other = siblings[i + d];
    if (!other) return;
    save(p.id, { position: other.position }, 0);
    save(other.id, { position: p.position }, 0);
  }

  async function exportWord() {
    const title = group !== "all" && group !== "none" ? `Nursing Care Plans – ${caseById.get(group)?.title ?? ""}` : "Nursing Care Plans";
    const blob = await markdownToDocx(title, "Prepared with Nurse Mira · check with your clinical instructor", shown.map((p) => ({ title: p.plan.diagnosis || planTitle(p.plan), content: planToMarkdown(p.plan) })));
    downloadBlob(blob, `${title.replace(/[^\w\- ]+/g, "").trim() || "care-plans"}.docx`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
            <ClipboardList size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">NCP Builder</h1>
            <p className="mt-1 text-sm text-mira-muted">
              Make as many Nursing Care Plans as you need — Assessment, Diagnosis, Outcomes, Planning, Interventions, Rationale and Evaluation. Cues come only from
              your own data; anything else is listed under “Still to assess”. Plans are private and can be linked to a case study.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["case", "From one of my case studies", cases.length ? "Uses that case's de-identified information" : "You have no case studies yet"],
              ["typed", "Type the assessment data", "For a quick plan without a case study"],
            ] as const
          ).map(([v, label, hint]) => (
            <label key={v} className={`flex gap-2 rounded-lg p-3 text-sm ring-1 ${v === "case" && !cases.length ? "opacity-60" : "cursor-pointer"} ${source === v ? "bg-mira-blue-soft ring-mira-blue" : "ring-mira-line"}`}>
              <input type="radio" name="ncp-source" disabled={v === "case" && !cases.length} checked={source === v} onChange={() => setSource(v)} className="mt-0.5 accent-mira-blue" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="text-xs text-mira-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {source === "case" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Case study</span>
              <select value={genCase} onChange={(e) => setGenCase(e.target.value)} className={inputClass}>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.deidentified_confirmed ? "" : " (de-identification not confirmed yet)"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="font-medium">Assessment data</span>
              <span className="block text-xs text-mira-muted">Age, diagnosis, what the patient said, vital signs, findings, orders — no names or identifying details.</span>
              <textarea value={typed} onChange={(e) => setTyped(e.target.value.slice(0, 8000))} rows={5} className={`${inputClass} mt-1`} />
              {typedWarnings.length > 0 && (
                <span className="mt-1 flex items-start gap-1.5 text-xs text-mira-danger">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {typedWarnings.join(" ")}
                </span>
              )}
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="text-sm">
              <span className="mb-1 block font-medium">How many NCPs</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputClass}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Diagnoses you need (optional)</span>
              <input value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={600} placeholder="e.g. Acute pain, Risk for injury, Deficient knowledge" className={inputClass} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={generate} disabled={busy} className={buttonClass("accent")}>
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
              {busy ? `Writing ${count} care plan${count === 1 ? "" : "s"}… (up to 30 seconds)` : `Generate ${count} NCP${count === 1 ? "" : "s"}`}
            </button>
            <span className="text-xs text-mira-muted">Uses 1 AI answer ({remaining} left today).</span>
          </div>
        </div>
      </Card>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-mira-danger"}`}>
          <span className="flex-1">{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">My care plans</h2>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Show plans for">
            <option value="all">All plans</option>
            <option value="none">Not linked to a case study</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                Case: {c.title}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <button type="button" onClick={addBlank} className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <Plus size={16} aria-hidden /> Blank plan
          </button>
          <button type="button" onClick={exportWord} disabled={!shown.length} className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <FileDown size={16} aria-hidden /> Word
          </button>
          <a href={`/print/ncp?group=${group}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "!px-3 !py-1.5")}>
            <Printer size={16} aria-hidden /> Print / PDF
          </a>
        </div>
        {group !== "all" && group !== "none" && (
          <p className="text-sm text-mira-muted">
            Linked to <Link href={`/case-studies/${group}`} className="text-mira-blue hover:underline">{caseById.get(group)?.title}</Link>
          </p>
        )}

        {shown.length === 0 ? (
          <EmptyState title="No care plans here yet">Generate some above, or add a blank plan to write yourself.</EmptyState>
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
                    <span className="text-sm font-semibold text-mira-muted">NCP {i + 1}</span>
                    <span className="truncate font-medium">{planTitle(p.plan)}</span>
                  </button>
                  {group === "all" && <span className="text-xs text-mira-muted">{p.case_study_id ? caseById.get(p.case_study_id)?.title : "Not linked"}</span>}
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
                      {p.ai_generated && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">AI draft — check every cue against your assessment</span>}
                    </label>
                    <PlanEditor plan={p.plan} onChange={(plan) => save(p.id, { plan })} />
                  </div>
                )}
              </Card>
            );
          })
        )}
        <p className="text-xs text-mira-muted">Care plans are a learning aid. They don&apos;t replace your clinical instructor&apos;s supervision or your own clinical judgment.</p>
      </section>
    </div>
  );
}
