"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, FileDown, Home, Loader2, Plus, Printer, RefreshCw, Save, Search, Sparkles, Trash2, X } from "lucide-react";
import { buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { findIdentifiers } from "@/lib/case/facts";
import { COLUMNS, DOC_TITLE, emptyRow, MAX_ROWS, normalizePlan, pdfFileName, type ColumnKey, type FamilyPlan } from "@/lib/fncp/plan";

export type SavedPlan = { id: string; title: string; input: string; plan: FamilyPlan; ai_generated: boolean; updated_at: string };
type Status = "saved" | "unsaved" | "saving" | "error";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("fncp", { body });
  if (error || !data || data.error) {
    let message = data?.error as string | undefined;
    if (!message && error) {
      try {
        message = (await (error as { context?: Response }).context?.json())?.error;
      } catch {
        /* ignore */
      }
    }
    if (!["limit", "busy", "invalid"].includes(data?.kind)) reportProblem("fncp", problemKind(data, !!error), message);
    return { ok: false as const, message: message ?? "Nurse Mira couldn't reach the AI. Check your internet and try again — your description is kept." };
  }
  return { ok: true as const, data };
}

const EXAMPLES = [
  "Non-adherence to medication due to lack of knowledge.",
  "There is an open drainage in the community where mosquitoes are breeding. A family member is diabetic and has been bitten by mosquitoes. Connect the environmental problem with the patient's diabetes and focus on sanitation, preventing mosquito exposure and preventing skin complications. Include the family's involvement.",
];

export function FncpMaker({ plans: initial, studentName, initialOpen, remaining: initialRemaining }: { plans: SavedPlan[]; studentName: string; initialOpen: string | null; remaining: number }) {
  const [plans, setPlans] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(initialOpen && initial.some((p) => p.id === initialOpen) ? initialOpen : null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [remaining, setRemaining] = useState(initialRemaining);
  const warnings = findIdentifiers(input);
  const open = plans.find((p) => p.id === openId) ?? null;

  const show = (id: string | null) => {
    setOpenId(id);
    window.history.replaceState(null, "", id ? `/family-care-plans?plan=${id}` : "/family-care-plans");
    window.scrollTo({ top: 0 });
  };

  async function generate() {
    setError(null);
    if (input.trim().length < 10) return setError("Please describe the family problem or situation — a sentence or more.");
    if (warnings.length) return setError("Remove the identifying details first.");
    setBusy(true);
    const r = await invoke({ action: "generate", input: input.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (typeof r.data.remaining === "number") setRemaining(r.data.remaining);
    const saved: SavedPlan = { id: r.data.id, title: r.data.title, input: input.trim(), plan: normalizePlan(r.data.plan), ai_generated: true, updated_at: new Date().toISOString() };
    setPlans((l) => [saved, ...l]);
    setInput("");
    show(saved.id);
  }

  if (open) {
    return (
      <PlanEditor
        key={open.id}
        initial={open}
        studentName={studentName}
        remaining={remaining}
        onRemaining={setRemaining}
        onChange={(p) => setPlans((l) => l.map((x) => (x.id === p.id ? p : x)))}
        onDeleted={() => {
          setPlans((l) => l.filter((x) => x.id !== open.id));
          show(null);
        }}
        onBack={() => show(null)}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q ? plans.filter((p) => `${p.title} ${p.input}`.toLowerCase().includes(q)) : plans;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
            <Home size={24} aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold">FNCP Maker</h1>
            <p className="mt-1 text-sm text-mira-muted">
              Describe the family problem or situation you want to address. You may include additional details or tell Nurse Mira what you want the care plan to
              focus on. Nurse Mira makes the full {DOC_TITLE.toLowerCase()} in your school&apos;s seven-column format — you can edit everything afterwards.
            </p>
          </div>
        </div>
        <label htmlFor="fncp-input" className="sr-only">
          Family problem or situation
        </label>
        <textarea
          id="fncp-input"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 6000))}
          rows={7}
          placeholder="Describe the family problem or situation here..."
          className={`${inputClass} mt-4 text-[15px] leading-relaxed`}
          disabled={busy}
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mira-muted">
          <span>Examples:</span>
          {EXAMPLES.map((e, i) => (
            <button key={i} type="button" onClick={() => setInput(e)} className="rounded-full bg-mira-page px-2.5 py-1 ring-1 ring-mira-line hover:ring-mira-blue" disabled={busy}>
              {i === 0 ? "Simple problem" : "Situation with instructions"}
            </button>
          ))}
          <span className="ml-auto">{input.length}/6000</span>
        </div>
        {warnings.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-mira-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {warnings.join(" ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={generate} disabled={busy || input.trim().length < 10} className={buttonClass("accent")}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
            {busy ? "Nurse Mira is writing your care plan…" : "Generate Family Nursing Care Plan"}
          </button>
          <span className="text-xs text-mira-muted">Uses 1 AI answer ({remaining} left today). No real names or ID numbers, please.</span>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {error}
          </p>
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">My family care plans</h2>
          <span className="flex-1" />
          {plans.length > 3 && (
            <label className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mira-muted" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search my plans" className={`${inputClass} !w-56 pl-8`} aria-label="Search my plans" />
            </label>
          )}
        </div>
        {shown.length === 0 ? (
          <EmptyState title={plans.length ? "No plans match your search" : "No family care plans yet"}>
            {plans.length ? "Try another word." : "Describe a family problem above and press Generate."}
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <button key={p.id} type="button" onClick={() => show(p.id)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-mira-line hover:ring-mira-blue">
                <p className="line-clamp-2 font-semibold">{p.title}</p>
                <p className="mt-1 text-xs text-mira-muted">
                  {p.plan.rows.length} problem{p.plan.rows.length === 1 ? "" : "s"} · edited {new Date(p.updated_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlanEditor({
  initial,
  studentName,
  remaining,
  onRemaining,
  onChange,
  onDeleted,
  onBack,
}: {
  initial: SavedPlan;
  studentName: string;
  remaining: number;
  onRemaining: (n: number) => void;
  onChange: (p: SavedPlan) => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState(initial);
  const [status, setStatus] = useState<Status>("saved");
  const [working, setWorking] = useState<string | null>(null); // "all" or "row-col"
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(doc);
  useEffect(() => {
    latest.current = doc;
  }, [doc]);
  const warnings = useMemo(() => findIdentifiers(doc.input), [doc.input]);

  async function persist() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = latest.current;
    setStatus("saving");
    const now = new Date().toISOString();
    const { error } = await createClient()
      .from("family_care_plans")
      .update({ title: d.title.trim() || "Untitled family care plan", input: d.input, plan: d.plan, updated_at: now })
      .eq("id", d.id);
    setStatus(error ? "error" : "saved");
    if (!error) onChange({ ...d, updated_at: now });
  }

  function update(next: SavedPlan) {
    latest.current = next;
    setDoc(next);
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 1000);
  }

  // Save anything pending when leaving the page.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (timer.current) {
        persist();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) persist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCell = (row: number, key: ColumnKey, value: string) => {
    const d = latest.current;
    update({ ...d, plan: { rows: d.plan.rows.map((r, i) => (i === row ? { ...r, [key]: value } : r)) } });
  };

  async function regenerateAll() {
    if (warnings.length) return setMessage({ ok: false, text: "Remove the identifying details from the situation first." });
    if (!confirm("Make a fresh version of the WHOLE plan from the situation above? Your current table (including your edits) will be replaced.")) return;
    if (timer.current) await persist();
    setWorking("all");
    setMessage(null);
    const r = await invoke({ action: "generate", id: doc.id, input: doc.input });
    setWorking(null);
    if (!r.ok) return setMessage({ ok: false, text: r.message });
    if (typeof r.data.remaining === "number") onRemaining(r.data.remaining);
    const next = { ...doc, plan: normalizePlan(r.data.plan), updated_at: new Date().toISOString() };
    setDoc(next);
    setStatus("saved");
    onChange(next);
    setMessage({ ok: true, text: "New version made and saved." });
  }

  async function regenerateCell(row: number, key: ColumnKey, label: string) {
    if (timer.current) await persist();
    setWorking(`${row}-${key}`);
    setMessage(null);
    const r = await invoke({ action: "section", id: doc.id, row, column: key, plan: latest.current.plan });
    setWorking(null);
    if (!r.ok) return setMessage({ ok: false, text: r.message });
    if (typeof r.data.remaining === "number") onRemaining(r.data.remaining);
    setCell(row, key, String(r.data.text));
    setMessage({ ok: true, text: `“${label}” rewritten${doc.plan.rows.length > 1 ? ` for problem ${row + 1}` : ""} — the rest of the plan was kept.` });
  }

  async function downloadPdf() {
    if (timer.current) await persist();
    const [{ jsPDF }, { autoTable }, { buildFncpPdf }] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("@/lib/fncp/plan")]);
    const d = latest.current;
    const pdf = buildFncpPdf(jsPDF, autoTable, d.plan, {
      situation: d.input,
      preparedBy: studentName ? `Nurse ${studentName}` : undefined,
      date: new Date().toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }),
    });
    pdf.save(pdfFileName(d.title));
  }

  async function remove() {
    if (!confirm(`Delete “${doc.title}”? This can't be undone.`)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { error } = await createClient().from("family_care_plans").delete().eq("id", doc.id);
    if (error) return setMessage({ ok: false, text: "It couldn't be deleted. Please try again." });
    onDeleted();
  }

  const statusText = { saved: "All changes saved", unsaved: "Unsaved changes…", saving: "Saving…", error: "Not saved — check your internet" }[status];

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline">
        <ArrowLeft size={16} aria-hidden /> All family care plans
      </button>

      <Card>
        <div className="flex flex-wrap items-start gap-3">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-medium uppercase tracking-wide text-mira-muted">Plan name</span>
            <input value={doc.title} onChange={(e) => update({ ...doc, title: e.target.value.slice(0, 200) })} className={`${inputClass} mt-1 font-semibold`} />
          </label>
          <div className="flex flex-wrap items-center gap-2 pt-5">
            <span className={`flex items-center gap-1 text-xs ${status === "error" ? "text-mira-danger" : "text-mira-muted"}`} role="status">
              {status === "saved" ? <Check size={14} aria-hidden /> : status === "saving" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
              {statusText}
            </span>
            <button type="button" onClick={persist} disabled={status === "saving"} className={buttonClass("secondary", "!px-3 !py-1.5")}>
              <Save size={16} aria-hidden /> Save
            </button>
            <button type="button" onClick={downloadPdf} className={buttonClass("primary", "!px-3 !py-1.5")}>
              <FileDown size={16} aria-hidden /> Download PDF
            </button>
            <a href={`/print/fncp/${doc.id}`} target="_blank" rel="noreferrer" onClick={() => timer.current && persist()} className={buttonClass("secondary", "!px-3 !py-1.5")}>
              <Printer size={16} aria-hidden /> Print
            </a>
            <button type="button" onClick={remove} className={buttonClass("secondary", "!px-3 !py-1.5")} aria-label="Delete plan">
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Family problem or situation (your description)</span>
          <textarea value={doc.input} onChange={(e) => update({ ...doc, input: e.target.value.slice(0, 6000) })} rows={3} className={`${inputClass} mt-1`} />
        </label>
        {warnings.length > 0 && <p className="mt-1 text-xs text-mira-danger">{warnings.join(" ")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={regenerateAll} disabled={!!working} className={buttonClass("accent", "!py-2")}>
            {working === "all" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />}
            {working === "all" ? "Making a new version…" : "Regenerate whole plan"}
          </button>
          <span className="text-xs text-mira-muted">
            Or use the <RefreshCw size={12} className="inline" aria-label="redo" /> button on any part to rewrite just that part. Each uses 1 AI answer ({remaining} left today).
          </span>
        </div>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-950"}`}>
            <span className="flex-1">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">
              <X size={15} />
            </button>
          </p>
        )}
      </Card>

      {/* The table — wide; scrolls sideways on small screens instead of shrinking. */}
      <section aria-label={DOC_TITLE}>
        <h2 className="mb-2 text-center text-base font-bold tracking-wide">{DOC_TITLE}</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-mira-line">
          <table className="w-full min-w-[1150px] border-collapse text-sm">
            <thead>
              <tr>
                {COLUMNS.map(([k, label]) => (
                  <th key={k} scope="col" className="border border-mira-line bg-mira-blue px-2 py-2 text-center font-semibold text-white">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.plan.rows.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {COLUMNS.map(([k, label]) => {
                    const isWorking = working === `${ri}-${k}`;
                    return (
                      <td key={k} className="border border-mira-line p-0">
                        <div className="relative">
                          <textarea
                            value={row[k]}
                            onChange={(e) => setCell(ri, k, e.target.value.slice(0, 4000))}
                            aria-label={`${label}${doc.plan.rows.length > 1 ? `, problem ${ri + 1}` : ""}`}
                            className="block min-h-48 w-full resize-none bg-transparent px-2 pb-8 pt-2 text-[13px] leading-snug outline-none [field-sizing:content] focus:bg-mira-blue-soft/40"
                            disabled={isWorking || working === "all"}
                          />
                          <button
                            type="button"
                            onClick={() => regenerateCell(ri, k, label)}
                            disabled={!!working}
                            title={`Rewrite “${label}” only`}
                            aria-label={`Rewrite ${label} only`}
                            className="absolute bottom-1.5 right-1.5 rounded-md bg-white p-1 text-mira-muted ring-1 ring-mira-line hover:text-mira-blue disabled:opacity-40"
                          >
                            {isWorking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {doc.plan.rows.length < MAX_ROWS && (
            <button type="button" onClick={() => update({ ...doc, plan: { rows: [...doc.plan.rows, emptyRow()] } })} className={buttonClass("secondary", "!px-3 !py-1.5")}>
              <Plus size={16} aria-hidden /> Add a family problem (row)
            </button>
          )}
          {doc.plan.rows.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove problem ${doc.plan.rows.length} (the last row)?`)) update({ ...doc, plan: { rows: doc.plan.rows.slice(0, -1) } });
              }}
              className={buttonClass("secondary", "!px-3 !py-1.5")}
            >
              <Trash2 size={16} aria-hidden /> Remove last row
            </button>
          )}
          <p className="ml-auto text-xs text-mira-muted sm:hidden">Swipe the table sideways to see all seven columns.</p>
        </div>
        <p className="mt-3 text-xs text-mira-muted">
          AI-drafted — check it against your lessons and your clinical instructor, rewrite it in your own words, and follow your school&apos;s rules on AI use. The Evaluation
          column shows what to check after carrying out the plan; replace it with your actual results when you have them.
        </p>
      </section>
    </div>
  );
}
