"use client";

import { useActionState, useState, useTransition } from "react";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { Badge, buttonClass, inputClass } from "@/components/ui";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import {
  addSubject,
  addTopic,
  renameTopic,
  setSubjectActive,
  setTopicActive,
  updateSubject,
  type Result,
} from "./actions";

export type Topic = { id: string; name: string; is_active: boolean };
export type SubjectRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  year_level: number;
  semester: number;
  is_active: boolean;
  topics: Topic[];
  students: number;
};

function Message({ result }: { result: Result | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700" : "text-mira-danger"}`}>
      {result.ok ? "✓ " : ""}
      {result.message}
    </p>
  );
}

function TopicItem({ topic }: { topic: Topic }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg bg-mira-page px-3 py-2 text-sm">
      {editing ? (
        <form
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await renameTopic(topic.id, name);
              setResult(r);
              if (r.ok) setEditing(false);
            });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Topic name" className={`${inputClass} !mt-0 flex-1`} autoFocus />
          <button type="submit" disabled={pending} className={buttonClass("primary", "!py-2")}>
            Save
          </button>
          <button type="button" onClick={() => (setEditing(false), setName(topic.name))} className={buttonClass("secondary", "!py-2")}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className={`flex-1 ${topic.is_active ? "" : "text-mira-muted line-through"}`}>{topic.name}</span>
          {!topic.is_active && <Badge tone="gray">Retired</Badge>}
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-mira-muted hover:text-mira-blue" aria-label={`Rename ${topic.name}`}>
            <Pencil size={14} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await setTopicActive(topic.id, !topic.is_active)))}
            className="text-xs text-mira-muted underline hover:text-mira-ink"
          >
            {topic.is_active ? "Retire" : "Restore"}
          </button>
        </>
      )}
      {result && !result.ok && (
        <div className="w-full">
          <Message result={result} />
        </div>
      )}
    </li>
  );
}

function SubjectEditor({ subject }: { subject: SubjectRow }) {
  const [saveResult, saveAction, saving] = useActionState(updateSubject.bind(null, subject.id), null);
  const [topicResult, topicAction, addingTopic] = useActionState(addTopic.bind(null, subject.id), null);
  const [statusResult, setStatusResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [topicKey, setTopicKey] = useState(0);

  return (
    <div className="space-y-5 border-t border-mira-line px-4 pb-5 pt-4">
      <form action={saveAction} className="space-y-3">
        <label className="block text-sm font-medium">
          Subject title
          <input name="title" defaultValue={subject.title} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Description <span className="font-normal text-mira-muted">(optional — helps Nurse Mira understand the subject)</span>
          <textarea name="description" defaultValue={subject.description ?? ""} rows={2} className={inputClass} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : "Save subject"}
          </button>
          <Message result={saveResult} />
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Topics</h3>
        {subject.topics.length === 0 ? (
          <p className="mb-3 text-sm text-mira-muted">No topics yet. Topics help organize reviewers, quizzes and study sessions.</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {subject.topics.map((t) => (
              <TopicItem key={`${t.id}-${t.name}-${t.is_active}`} topic={t} />
            ))}
          </ul>
        )}
        <form
          key={topicKey}
          action={async (fd) => {
            await topicAction(fd);
            setTopicKey((k) => k + 1);
          }}
          className="flex flex-wrap gap-2"
        >
          <input name="name" placeholder="New topic, e.g. Preeclampsia" aria-label="New topic name" className={`${inputClass} !mt-0 max-w-sm flex-1`} />
          <button type="submit" disabled={addingTopic} className={buttonClass("secondary")}>
            <Plus size={16} aria-hidden /> Add topic
          </button>
        </form>
        <div className="mt-2">
          <Message result={topicResult} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-mira-line pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setStatusResult(await setSubjectActive(subject.id, !subject.is_active)))}
          className={buttonClass(subject.is_active ? "secondary" : "primary")}
        >
          {subject.is_active ? "Retire this subject" : "Restore this subject"}
        </button>
        <span className="text-xs text-mira-muted">
          {subject.is_active
            ? "Retired subjects are hidden from new choices but stay in existing records."
            : "This subject is hidden from new choices."}
        </span>
        <Message result={statusResult} />
      </div>
    </div>
  );
}

export function SubjectCard({ subject }: { subject: SubjectRow }) {
  const [open, setOpen] = useState(false);
  const activeTopics = subject.topics.filter((t) => t.is_active).length;
  return (
    <li id={subject.id} className={`overflow-hidden rounded-xl ring-1 ring-mira-line ${subject.is_active ? "bg-white" : "bg-mira-page"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-mira-page/60"
      >
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{subject.code}</span> — {subject.title}
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="blue">{subject.students} student(s)</Badge>
            <Badge tone="gray">{activeTopics} topic(s)</Badge>
            {!subject.is_active && <Badge tone="yellow">Retired</Badge>}
          </span>
        </span>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-mira-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && <SubjectEditor subject={subject} />}
    </li>
  );
}

export function AddSubject() {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState(addSubject, null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("accent")}>
        <Plus size={18} aria-hidden /> Add subject
      </button>
    );
  }
  return (
    <form action={action} className="w-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-mira-line">
      <h2 className="mb-1 font-semibold">Add a subject</h2>
      <p className="mb-4 text-sm text-mira-muted">For future curriculum changes. Use the exact code and title from the school prospectus.</p>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <label className="block text-sm font-medium">
          Code
          <input name="code" required placeholder="NCM 123" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Title
          <input name="title" required className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Year level
          <select name="year_level" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                {YEAR_LABEL[y]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Semester
          <select name="semester" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {[1, 2].map((s) => (
              <option key={s} value={s}>
                {SEM_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Adding…" : "Add subject"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>
          Close
        </button>
        <Message result={result} />
      </div>
    </form>
  );
}
