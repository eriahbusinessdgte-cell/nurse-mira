"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Sparkles, Upload, X } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_ATTR, ACCEPTED, ExtractError, extractText, fileKind, sha256, type Extracted } from "@/lib/library/extract";
import { formatBytes, SOURCE_TYPES } from "@/lib/library/labels";
import { suggestMetadata, type SubjectLite, type TopicLite } from "@/lib/library/suggest";
import { uploadDocument, type Step } from "@/lib/library/upload";
import { maybeShrink } from "@/lib/library/shrink";
import { totalChars } from "@/lib/library/chunk";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";

type Props = { subjects: SubjectLite[]; topics: TopicLite[]; label?: string };

type Prepared = { file: File; kind: string; sha: string; extracted: Extracted; chars: number; upload: File; uploadKind: string };

export function UploadDialog({ subjects, topics, label = "Upload" }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [rights, setRights] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [sourceType, setSourceType] = useState("student_notes");
  const [suggested, setSuggested] = useState<{ subject: boolean; topic: boolean }>({ subject: false, topic: false });

  const [step, setStep] = useState<Step | null>(null);
  const [finished, setFinished] = useState(false);

  const subjectTopics = useMemo(() => topics.filter((t) => t.subject_id === subjectId), [topics, subjectId]);
  const subject = subjects.find((s) => s.id === subjectId);

  const reset = () => {
    setReading(null);
    setPrepared(null);
    setError(null);
    setWarning(null);
    setRights(false);
    setTitle("");
    setSubjectId("");
    setTopicId("");
    setSourceType("student_notes");
    setSuggested({ subject: false, topic: false });
    setStep(null);
    setFinished(false);
  };

  const close = () => {
    if (step && !finished && !error) return; // don't close mid-upload
    const changed = finished;
    setOpen(false);
    reset();
    if (changed) router.refresh();
  };

  async function choose(file: File) {
    reset();
    const kind = fileKind(file);
    if (!kind) {
      setError("This type of file isn't supported. Please upload a PDF, Word (.docx), PowerPoint (.pptx), text file, or a JPG/PNG photo.");
      return;
    }
    try {
      setReading("Checking the file…");
      const sha = await sha256(file);

      // Duplicates (checked first, so nothing is read twice): is this exact file already in the shared library?
      const supabase = createClient();
      const { data: dupes } = await supabase.rpc("find_shared_duplicate", { p_sha256: sha });
      const dup = (dupes as { title: string; status: string }[] | null)?.[0];
      if (dup) {
        setError(
          `This exact file is already in the shared library as “${dup.title}”${dup.status === "archived" ? " (archived)" : ""}, so there's no need to upload it again. Everyone can already learn from it.`,
        );
        setReading(null);
        return;
      }

      const extracted = await extractText(file, setReading);
      const chars = totalChars(extracted.pages);
      if (chars < 100) {
        throw new ExtractError(
          extracted.unreadablePages.length
            ? `Nurse Mira couldn't read the writing in this file${extracted.notice ? ` — ${extracted.notice}` : ". The photos may be blurry, dark or at an angle. Try clearer, well-lit photos taken straight on."}`
            : "Nurse Mira couldn't find readable text in this file, so it can't be added. If it's a photo or scan, make sure the text is clear and well lit, then try again.",
        );
      }
      const s = suggestMetadata(file.name, extracted.pages.map((p) => p.text).join("\n"), subjects, topics);
      setTitle(s.title);
      setSubjectId(s.subject_id ?? "");
      setTopicId(s.topic_id ?? "");
      setSuggested({ subject: !!s.subject_id, topic: !!s.topic_id });
      const notes: string[] = [];
      if (extracted.unreadablePages.length) {
        const list = extracted.unreadablePages.slice(0, 8).join(", ") + (extracted.unreadablePages.length > 8 ? "…" : "");
        notes.push(
          `${extracted.unreadablePages.length} photo page(s) (page ${list}) couldn't be read${extracted.notice ? ` — ${extracted.notice}` : " (they may be blurry or very faint)"}. You can still upload; press “Read again” on the document later to try those pages again.`,
        );
      } else if (extracted.method !== "text") {
        notes.push("Some pages were read from photos or handwriting, so a few words may be misread. Please check the title and subject.");
      }


      // Make photo-heavy files smaller before uploading (free, in the browser).
      const smaller = await maybeShrink(file, kind, extracted.pageCount, extracted.imagePages, setReading);
      if (smaller) notes.push(`Nurse Mira made a smaller copy to save storage: ${formatBytes(file.size)} → ${formatBytes(smaller.size)}. The smaller copy is the one stored.`);
      setWarning(notes.length ? notes.join(" ") : null);

      setPrepared({ file, kind, sha, extracted, chars, upload: smaller ?? file, uploadKind: smaller ? smaller.type : kind });
      setReading(null);
    } catch (e) {
      setReading(null);
      setError(e instanceof ExtractError ? e.message : "Something went wrong while reading the file. Please try again.");
    }
  }

  const ready = prepared && title.trim() && subjectId && rights;

  async function startUpload() {
    if (!prepared || !subject) return;
    setError(null);
    try {
      await uploadDocument(
        {
          file: prepared.upload,
          originalName: prepared.file.name,
          kind: prepared.uploadKind,
          sha256: prepared.sha,
          extracted: prepared.extracted,
          visibility: "shared",
          title,
          subject_id: subject.id,
          topic_id: topicId || null,
          year_level: subject.year_level,
          semester: subject.semester,
          source_type: sourceType,
          rights_confirmed: rights,
        },
        setStep,
      );
      setFinished(true);
    } catch (e) {
      setError((e as Error).message || "The upload didn't finish. Please try again.");
      setFinished(true); // the record exists (marked as needing attention) — refresh the list on close
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("accent")}>
        <Upload size={18} aria-hidden /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="upload-title" className="text-lg font-semibold">
                Upload a document
              </h2>
              <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1 text-mira-muted hover:bg-mira-page">
                <X size={20} />
              </button>
            </div>

            {/* Progress / finished view */}
            {step ? (
              <div className="space-y-4 py-2">
                {finished && !error ? (
                  <div className="text-center">
                    <CheckCircle2 size={44} className="mx-auto text-mira-success" aria-hidden />
                    <p className="mt-3 text-lg font-semibold">Uploaded and ready!</p>
                    <p className="mt-1 text-sm text-mira-muted">
                      It&apos;s now in the shared library, and Nurse Mira can use it to help every student.
                    </p>
                  </div>
                ) : (
                  <div role="status" aria-live="polite">
                    <p className="font-medium">{step.label}…</p>
                    {step.total ? (
                      <>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-mira-line">
                          <div className="h-full rounded-full bg-mira-blue transition-all" style={{ width: `${Math.round(((step.done ?? 0) / step.total) * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-sm text-mira-muted">
                          {step.done} of {step.total} parts
                        </p>
                      </>
                    ) : (
                      <div className="mt-3 h-2.5 animate-pulse rounded-full bg-mira-blue/30" />
                    )}
                    {!error && <p className="mt-3 text-xs text-mira-muted">Please keep this window open until it finishes.</p>}
                  </div>
                )}
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
                    {error}
                  </p>
                )}
                {(finished || error) && (
                  <button type="button" onClick={close} className={buttonClass(error ? "secondary" : "primary", "w-full")}>
                    {error ? "Close — I'll retry from the list" : "Done"}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Step 1: file */}
                <div
                  onDragOver={(e) => (e.preventDefault(), setDragging(true))}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) choose(f);
                  }}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-mira-blue bg-mira-blue-soft" : "border-mira-line"}`}
                >
                  <FileUp size={28} className="mx-auto text-mira-blue" aria-hidden />
                  {prepared ? (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{prepared.file.name}</span>
                      <span className="text-mira-muted">
                        {" "}
                        · {prepared.upload !== prepared.file ? `${formatBytes(prepared.file.size)} → ${formatBytes(prepared.upload.size)}` : formatBytes(prepared.file.size)} ·{" "}
                        {ACCEPTED[prepared.kind]}
                        {prepared.extracted.pageCount ? ` · ${prepared.extracted.pageCount} pages` : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-mira-muted">Drag a file here, or choose one from your device.</p>
                  )}
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={!!reading} className={buttonClass("secondary", "mt-3")}>
                    {prepared ? "Choose a different file" : "Choose file"}
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT_ATTR}
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) choose(f);
                      e.target.value = "";
                    }}
                  />
                  <p className="mt-2 text-xs text-mira-muted">PDF, Word, PowerPoint, text, or JPG/PNG photo · up to 25 MB</p>
                </div>

                {reading && (
                  <p role="status" className="flex items-center gap-2 text-sm text-mira-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-mira-blue/25 border-t-mira-blue" /> {reading}
                  </p>
                )}
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
                    {error}
                  </p>
                )}
                {warning && !error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</p>}

                {prepared && (
                  <>
                    {/* Sharing notice */}
                    <div className="rounded-xl bg-mira-blue-soft p-4 text-sm text-mira-blue-dark">
                      <p className="font-medium">How sharing works</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        <li>
                          Everything you upload joins Nurse Mira&apos;s <strong>shared library</strong>, so the AI Tutor can use it to help
                          every student.
                        </li>
                        <li>
                          All Nurse Mira students can see it in the shared library (your name isn&apos;t shown). The original file can be
                          downloaded only if the administrator allows it.
                        </li>
                        <li>
                          Upload study notes and reviewers only — <strong>never</strong> patient information, personal case studies or
                          graded assignments.
                        </li>
                        <li>Don&apos;t upload paid review-center materials or textbooks without permission.</li>
                        <li>Photo and handwritten pages are read by Nurse Mira&apos;s page reader, an outside AI service (Cloudflare).</li>
                      </ul>
                      <label className="mt-3 flex items-start gap-2 font-medium">
                        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 h-4 w-4 accent-mira-blue" />
                        I&apos;m allowed to share this, and it contains no patient information.
                      </label>
                    </div>

                    {/* Step 3–4: details */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium sm:col-span-2">
                        Title
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                      </label>
                      <label className="block text-sm font-medium">
                        Subject
                        {suggested.subject && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-mira-blue">
                            <Sparkles size={12} aria-hidden /> suggested
                          </span>
                        )}
                        <select
                          value={subjectId}
                          onChange={(e) => {
                            setSubjectId(e.target.value);
                            setTopicId("");
                            setSuggested({ subject: false, topic: false });
                          }}
                          className={inputClass}
                        >
                          <option value="">Choose a subject…</option>
                          {[1, 2, 3, 4].map((y) =>
                            [1, 2].map((s) => (
                              <optgroup key={`${y}-${s}`} label={`${YEAR_LABEL[y]} · ${SEM_LABEL[s]}`}>
                                {subjects
                                  .filter((x) => x.year_level === y && x.semester === s)
                                  .map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.code} — {x.title.length > 60 ? `${x.title.slice(0, 60)}…` : x.title}
                                    </option>
                                  ))}
                              </optgroup>
                            )),
                          )}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Topic <span className="font-normal text-mira-muted">(if known)</span>
                        {suggested.topic && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-mira-blue">
                            <Sparkles size={12} aria-hidden /> suggested
                          </span>
                        )}
                        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} className={inputClass}>
                          <option value="">{subjectTopics.length ? "No specific topic" : "No topics for this subject yet"}</option>
                          {subjectTopics.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium sm:col-span-2">
                        Where is it from?
                        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass}>
                          {SOURCE_TYPES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                              {s.hint ? ` — ${s.hint}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      {subject && (
                        <p className="text-xs text-mira-muted sm:col-span-2">
                          Will be filed under {YEAR_LABEL[subject.year_level]} · {SEM_LABEL[subject.semester]}. Found about{" "}
                          {Math.round(prepared.chars / 6).toLocaleString()} words.
                        </p>
                      )}
                    </div>

                    <button type="button" disabled={!ready} onClick={startUpload} className={buttonClass("primary", "w-full")}>
                      <Upload size={18} aria-hidden /> Upload
                    </button>
                    {!ready && (
                      <p className="text-center text-xs text-mira-muted">
                        {!rights ? "Tick the box to confirm you're allowed to share it." : !subjectId ? "Choose a subject." : "Add a title."}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
