"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, CircleDot, List, Loader2, Plus, Trash2, X } from "lucide-react";
import { buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  bucket,
  formatTime,
  KIND_COLOR,
  KIND_LABEL,
  monthGrid,
  PRIORITY_LABEL,
  sortItems,
  STATUS_LABEL,
  type Bucket,
  type Item,
  type Kind,
  type Priority,
  type Status,
} from "@/lib/planner/plan";

type Subject = { id: string; code: string; title: string };
type Draft = Omit<Item, "id" | "completed_at"> & { id?: string };

const BUCKETS: { key: Bucket; label: string; tone: string }[] = [
  { key: "overdue", label: "Overdue", tone: "text-mira-danger" },
  { key: "today", label: "Today", tone: "text-mira-blue" },
  { key: "week", label: "Next 7 days", tone: "" },
  { key: "later", label: "Later", tone: "" },
  { key: "nodate", label: "No due date", tone: "text-mira-muted" },
  { key: "done", label: "Done", tone: "text-green-700" },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const prettyDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const blank = (due: string | null): Draft => ({
  title: "",
  kind: "assignment",
  subject_id: null,
  case_study_id: null,
  due_date: due,
  due_time: null,
  status: "todo",
  priority: "medium",
  notes: "",
});

function Editor({
  draft,
  subjects,
  cases,
  onSave,
  onDelete,
  onClose,
}: {
  draft: Draft;
  subjects: Subject[];
  cases: { id: string; title: string }[];
  onSave: (d: Draft) => Promise<string | null>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={d.id ? "Edit task" : "New task"}>
      <form
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!d.title.trim()) return setError("Please give the task a title.");
          setBusy(true);
          const err = await onSave(d);
          setBusy(false);
          if (err) setError(err);
        }}
      >
        <div className="mb-4 flex items-center">
          <h2 className="flex-1 text-lg font-semibold">{d.id ? "Edit task" : "New task"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-mira-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input value={d.title} onChange={(e) => set({ title: e.target.value.slice(0, 200) })} className={inputClass} placeholder="e.g. NCM 109 case study draft" autoFocus />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Type</span>
              <select value={d.kind} onChange={(e) => set({ kind: e.target.value as Kind })} className={inputClass}>
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Subject</span>
              <select value={d.subject_id ?? ""} onChange={(e) => set({ subject_id: e.target.value || null })} className={inputClass}>
                <option value="">None</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Due date</span>
              <input type="date" value={d.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value || null })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Time (optional)</span>
              <input type="time" value={d.due_time?.slice(0, 5) ?? ""} onChange={(e) => set({ due_time: e.target.value || null })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Priority</span>
              <select value={d.priority} onChange={(e) => set({ priority: e.target.value as Priority })} className={inputClass}>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Status</span>
              <select value={d.status} onChange={(e) => set({ status: e.target.value as Status })} className={inputClass}>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(d.kind === "case_study" || d.case_study_id) && cases.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Linked case study</span>
              <select value={d.case_study_id ?? ""} onChange={(e) => set({ case_study_id: e.target.value || null })} className={inputClass}>
                <option value="">None</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notes</span>
            <textarea value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value.slice(0, 4000) })} rows={3} className={inputClass} placeholder="Requirements, pages to read, what the instructor said…" />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-mira-danger">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className={buttonClass("primary")}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Save
          </button>
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancel
          </button>
          <span className="flex-1" />
          {onDelete && (
            <button type="button" onClick={onDelete} className={buttonClass("danger")}>
              <Trash2 size={16} aria-hidden /> Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function Planner({ items: initial, subjects, mySubjectIds, cases, today }: { items: Item[]; subjects: Subject[]; mySubjectIds: string[]; cases: { id: string; title: string }[]; today: string }) {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [showDone, setShowDone] = useState(false);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const filtered = items.filter((i) => !subjectFilter || i.subject_id === subjectFilter);
  const grouped = BUCKETS.map((b) => ({ ...b, items: filtered.filter((i) => bucket(i, today) === b.key).sort(sortItems) }));
  const counts = { overdue: grouped[0].items.length, today: grouped[1].items.length, week: grouped[2].items.length };

  async function save(d: Draft): Promise<string | null> {
    const supabase = createClient();
    const row = {
      title: d.title.trim(),
      kind: d.kind,
      subject_id: d.subject_id,
      case_study_id: d.case_study_id,
      due_date: d.due_date,
      due_time: d.due_time,
      status: d.status,
      priority: d.priority,
      notes: d.notes?.trim() || null,
      completed_at: d.status === "done" ? new Date().toISOString() : null,
    };
    if (d.id) {
      const { data, error } = await supabase.from("planner_items").update(row).eq("id", d.id).select("*").single();
      if (error || !data) return "The task couldn't be saved. Please try again.";
      setItems((l) => l.map((i) => (i.id === d.id ? (data as Item) : i)));
    } else {
      const user = (await supabase.auth.getSession()).data.session?.user;
      const { data, error } = await supabase.from("planner_items").insert({ ...row, student_id: user?.id }).select("*").single();
      if (error || !data) return "The task couldn't be saved. Please try again.";
      setItems((l) => [...l, data as Item]);
    }
    setEditing(null);
    return null;
  }

  async function setStatus(item: Item, status: Status) {
    setItems((l) => l.map((i) => (i.id === item.id ? { ...i, status } : i)));
    await createClient()
      .from("planner_items")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", item.id);
  }

  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    const { error } = await createClient().from("planner_items").delete().eq("id", id);
    if (!error) {
      setItems((l) => l.filter((i) => i.id !== id));
      setEditing(null);
    }
  }

  const Row = ({ item }: { item: Item }) => {
    const subject = item.subject_id ? subjectById.get(item.subject_id) : undefined;
    const done = item.status === "done";
    const next: Status = item.status === "todo" ? "in_progress" : item.status === "in_progress" ? "done" : "todo";
    return (
      <li className="flex items-start gap-3 py-2.5">
        <button
          type="button"
          onClick={() => setStatus(item, next)}
          className={`mt-0.5 shrink-0 ${done ? "text-green-600" : item.status === "in_progress" ? "text-mira-blue" : "text-mira-muted hover:text-mira-blue"}`}
          aria-label={`${STATUS_LABEL[item.status]} — change to ${STATUS_LABEL[next]}`}
          title={`${STATUS_LABEL[item.status]} (click for ${STATUS_LABEL[next]})`}
        >
          {done ? <Check size={20} className="rounded-full bg-green-100 p-0.5" /> : item.status === "in_progress" ? <CircleDot size={20} /> : <Circle size={20} />}
        </button>
        <button type="button" onClick={() => setEditing(item)} className="min-w-0 flex-1 text-left">
          <p className={`font-medium ${done ? "text-mira-muted line-through" : ""}`}>{item.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mira-muted">
            <span className={`rounded px-1.5 py-0.5 ${KIND_COLOR[item.kind]}`}>{KIND_LABEL[item.kind]}</span>
            {item.priority === "high" && <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-mira-danger">High priority</span>}
            {subject && <span>{subject.title}</span>}
            {item.due_date && (
              <span>
                · {prettyDate(item.due_date)}
                {item.due_time ? `, ${formatTime(item.due_time)}` : ""}
              </span>
            )}
            {item.status === "in_progress" && <span>· in progress</span>}
          </p>
        </button>
      </li>
    );
  };

  const weeks = monthGrid(month.y, month.m);
  const byDay = new Map<string, Item[]>();
  for (const i of filtered) if (i.due_date) byDay.set(i.due_date, [...(byDay.get(i.due_date) ?? []), i].sort(sortItems));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
            <CalendarDays size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">My Planner</h1>
            <p className="text-sm text-mira-muted">
              {counts.overdue > 0 && <span className="font-medium text-mira-danger">{counts.overdue} overdue · </span>}
              {counts.today} due today · {counts.week} in the next 7 days. Only you can see your planner.
            </p>
          </div>
          <button type="button" onClick={() => setEditing(blank(today))} className={buttonClass("accent")}>
            <Plus size={18} aria-hidden /> Add task
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-mira-page p-1">
            {(
              [
                ["list", "List", List],
                ["calendar", "Calendar", CalendarDays],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${view === v ? "bg-white font-medium text-mira-blue shadow-sm" : "text-mira-muted"}`}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {subjects
              .filter((s) => mySubjectIds.includes(s.id) || items.some((i) => i.subject_id === s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
        </div>
      </Card>

      {view === "list" ? (
        items.length === 0 ? (
          <EmptyState title="Your planner is empty" action={<button type="button" onClick={() => setEditing(blank(today))} className={buttonClass("primary")}>Add your first task</button>}>
            Add assignments, exams, case-study deadlines, clinical requirements and study sessions.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {grouped
              .filter((g) => g.items.length && (g.key !== "done" || showDone))
              .map((g) => (
                <Card key={g.key} className="!py-3">
                  <h2 className={`text-sm font-semibold uppercase tracking-wide ${g.tone}`}>
                    {g.label} ({g.items.length})
                  </h2>
                  <ul className="divide-y divide-mira-line">
                    {g.items.map((i) => (
                      <Row key={i.id} item={i} />
                    ))}
                  </ul>
                </Card>
              ))}
            {grouped[5].items.length > 0 && (
              <button type="button" onClick={() => setShowDone((s) => !s)} className="text-sm text-mira-blue hover:underline">
                {showDone ? "Hide" : "Show"} completed tasks ({grouped[5].items.length})
              </button>
            )}
          </div>
        )
      ) : (
        <Card className="!p-3 sm:!p-5">
          <div className="mb-3 flex items-center gap-2">
            <button type="button" onClick={() => setMonth(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }))} className={buttonClass("secondary", "!px-2.5")} aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <h2 className="flex-1 text-center text-lg font-semibold">
              {MONTHS[month.m - 1]} {month.y}
            </h2>
            <button type="button" onClick={() => setMonth(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }))} className={buttonClass("secondary", "!px-2.5")} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-mira-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-mira-line ring-1 ring-mira-line">
            {weeks.flat().map((day) => {
              const inMonth = Number(day.slice(5, 7)) === month.m;
              const dayItems = byDay.get(day) ?? [];
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setEditing(blank(day))}
                  className={`min-h-20 bg-white p-1 text-left align-top hover:bg-mira-blue-soft/40 sm:min-h-24 ${inMonth ? "" : "bg-mira-page/60 text-mira-muted"}`}
                  aria-label={`Add a task on ${prettyDate(day)}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${day === today ? "bg-mira-blue font-semibold text-white" : ""}`}>{Number(day.slice(8))}</span>
                  <span className="mt-0.5 block space-y-0.5">
                    {dayItems.slice(0, 3).map((i) => (
                      <span
                        key={i.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(i);
                        }}
                        className={`block truncate rounded px-1 text-[11px] leading-5 ${KIND_COLOR[i.kind]} ${i.status === "done" ? "line-through opacity-60" : ""}`}
                        title={i.title}
                      >
                        {i.title}
                      </span>
                    ))}
                    {dayItems.length > 3 && <span className="block px-1 text-[11px] text-mira-muted">+{dayItems.length - 3} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-mira-muted">Tap a day to add a task; tap a task to edit it.</p>
        </Card>
      )}

      {editing && (
        <Editor
          key={editing.id ?? `new-${editing.due_date}`}
          draft={editing}
          subjects={subjects}
          cases={cases}
          onSave={save}
          onDelete={editing.id ? () => remove(editing.id!) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
