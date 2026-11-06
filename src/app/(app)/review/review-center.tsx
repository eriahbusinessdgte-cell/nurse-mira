"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, GraduationCap, Library, Loader2, Sparkles } from "lucide-react";
import { buttonClass, Card, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { SheetView } from "./sheet-view";

export type SubjectOption = { id: string; code: string; title: string; year_level: number; semester: number; sort_order: number };
export type TopicOption = { id: string; subject_id: string; name: string };
export type SheetContent = {
  summary: string;
  key_concepts: { title: string; explanation: string }[];
  terms: { term: string; definition: string }[];
  comparison: { title: string; columns: string[]; rows: string[][] } | null;
  nursing_implications: string[];
  clinical_applications: string[];
  practice_questions: { question: string; options: string[]; answer: number; rationale: string }[];
  flashcards: { front: string; back: string }[];
  quick_review: string[];
  exam_tips: string[];
};
export type SheetRow = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  focus: string;
  content: SheetContent;
  sources: { n: number; title: string; page: number | null; source_type: string; status: string }[];
  from_library: boolean;
  created_at: string;
  views: number;
};

type Props = {
  subjects: SubjectOption[];
  topics: TopicOption[];
  mySubjectIds: string[];
  recent: Pick<SheetRow, "id" | "subject_id" | "focus" | "from_library" | "created_at" | "views">[];
  initialSheet: SheetRow | null;
  remaining: number;
  defaultYear: number | null;
  defaultSemester: number | null;
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function ReviewCenter({ subjects, topics, mySubjectIds, recent, initialSheet, remaining: initialRemaining, defaultYear, defaultSemester }: Props) {
  const initialSubject = initialSheet ? subjects.find((s) => s.id === initialSheet.subject_id) : undefined;
  const [year, setYear] = useState<number | "">(initialSubject?.year_level ?? defaultYear ?? "");
  const [semester, setSemester] = useState<number | "">(initialSubject?.semester ?? defaultSemester ?? "");
  const [subjectId, setSubjectId] = useState(initialSheet?.subject_id ?? "");
  const [focus, setFocus] = useState(initialSheet?.focus ?? "");
  const [sheet, setSheet] = useState<SheetRow | null>(initialSheet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [sheets, setSheets] = useState(recent);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const visibleSubjects = subjects.filter((s) => (year === "" || s.year_level === year) && (semester === "" || s.semester === semester));
  // The student's own subjects first.
  visibleSubjects.sort((a, b) => Number(mySubjectIds.includes(b.id)) - Number(mySubjectIds.includes(a.id)) || a.sort_order - b.sort_order);
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);
  const subjectSheets = sheets.filter((s) => s.subject_id === subjectId);
  const topicChoices = [
    ...new Map<string, string>([...subjectTopics.map((t): [string, string] => [key(t.name), t.name]), ...subjectSheets.map((x): [string, string] => [key(x.focus), x.focus])]).values(),
  ];
  const existing = subjectId && focus.trim().length >= 2 ? sheets.find((s) => s.subject_id === subjectId && key(s.focus) === key(focus)) : undefined;

  async function open(f = focus) {
    if (!subjectId || f.trim().length < 2 || busy) return;
    setBusy(true);
    setError(null);
    const topic = subjectTopics.find((t) => key(t.name) === key(f));
    const { data, error: fnError } = await createClient().functions.invoke("review", {
      body: { subject_id: subjectId, focus: f.trim(), topic_id: topic?.id ?? null },
    });
    setBusy(false);
    if (fnError || !data || data.error) {
      let message = data?.error as string | undefined;
      if (!message && fnError) {
        try {
          message = (await (fnError as { context?: Response }).context?.json())?.error;
        } catch {
          /* ignore */
        }
      }
      setError(message ?? "The study sheet couldn't be opened. Please try again.");
      return;
    }
    const s = data.sheet as SheetRow;
    setSheet(s);
    setFocus(s.focus);
    if (typeof data.remaining === "number") setRemaining(data.remaining);
    if (!sheets.some((x) => x.id === s.id)) setSheets((l) => [{ id: s.id, subject_id: s.subject_id, focus: s.focus, from_library: s.from_library, created_at: s.created_at, views: s.views }, ...l]);
    window.history.replaceState(null, "", `/review?sheet=${s.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (sheet) {
    const subject = subjectById.get(sheet.subject_id);
    return (
      <SheetView
        sheet={sheet}
        subjectLabel={subject ? `${subject.title} (${subject.code})` : ""}
        onBack={() => {
          setSheet(null);
          window.history.replaceState(null, "", "/review");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
            <GraduationCap size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">Review Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-mira-muted">
              Pick a subject and topic. Nurse Mira makes a study sheet from the shared library: summary, key concepts, terms, nursing implications,
              practice questions, flashcards and a quick review sheet. Sheets are shared, so if a classmate already made one it opens instantly and
              doesn&apos;t use your daily answers.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Year level</span>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value ? Number(e.target.value) : "");
                setSubjectId("");
              }}
              className={inputClass}
            >
              <option value="">All years</option>
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  {YEAR_LABEL[y]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Semester</span>
            <select
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value ? Number(e.target.value) : "");
                setSubjectId("");
              }}
              className={inputClass}
            >
              <option value="">Both semesters</option>
              {[1, 2].map((s) => (
                <option key={s} value={s}>
                  {SEM_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Subject</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
              <option value="">Choose a subject…</option>
              {visibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.code})
                  {mySubjectIds.includes(s.id) ? " ★" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visibleSubjects.length === 0 && <p className="mt-2 text-sm text-mira-muted">No subjects for that year and semester. Try “All years”.</p>}

        {subjectId && (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              open();
            }}
          >
            <label className="text-sm" htmlFor="focus">
              <span className="mb-1 block font-medium">Topic</span>
            </label>
            {(subjectTopics.length > 0 || subjectSheets.length > 0) && (
              <div className="mb-2 flex flex-wrap gap-2">
                {topicChoices.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setFocus(name)}
                    className={`rounded-full px-3 py-1.5 text-sm ring-1 ${key(name) === key(focus) ? "bg-mira-blue-soft text-mira-blue ring-mira-blue" : "bg-white ring-mira-line hover:ring-mira-blue"}`}
                  >
                    {name}
                    {subjectSheets.some((s) => key(s.focus) === key(name)) && <span className="ml-1 text-xs text-green-700">✓ ready</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                id="focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={120}
                placeholder="Type a topic, e.g. Preeclampsia, Insulin types, Fluid and electrolytes"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button type="submit" disabled={busy || focus.trim().length < 2} className={buttonClass("primary")}>
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : existing ? <BookOpenCheck size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
                {busy ? "Making your study sheet…" : existing ? "Open study sheet" : "Make study sheet"}
              </button>
            </div>
            <p className="mt-2 text-xs text-mira-muted">
              {existing
                ? "A classmate already made this sheet — opening it is free."
                : `A new sheet uses 1 of your daily AI answers (${remaining} left today). It takes about 10 seconds.`}
            </p>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
            {error}
          </p>
        )}
      </Card>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Library size={18} className="text-mira-blue" aria-hidden /> Study sheets made so far
        </h2>
        {sheets.length === 0 ? (
          <EmptyState title="No study sheets yet">Be the first: choose a subject and topic above.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sheets.map((s) => {
              const subject = subjectById.get(s.subject_id);
              return (
                <a key={s.id} href={`/review?sheet=${s.id}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mira-line hover:ring-mira-blue">
                  <p className="text-xs text-mira-muted">
                    <span className="font-medium text-mira-ink">{subject?.title ?? "Subject"}</span>
                    {subject ? ` (${subject.code})` : ""}
                    {mySubjectIds.includes(s.subject_id) ? " · your subject" : ""}
                  </p>
                  <p className="mt-0.5 font-semibold">{s.focus}</p>
                  <p className="mt-1 text-xs text-mira-muted">
                    {s.from_library ? "From the Nurse Mira library" : "General nursing knowledge"} · opened {s.views + 1}×
                  </p>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
