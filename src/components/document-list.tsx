"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Download, Globe2, Lock, Pencil, RotateCw, Trash2, X } from "lucide-react";
import { Badge, buttonClass, EmptyState, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteDocuments, setAllowDownload, setArchived, updateDocument, type Result } from "@/lib/library/actions";
import { formatBytes, PROCESSING_LABEL, sourceLabel, SOURCE_TYPES } from "@/lib/library/labels";
import type { SubjectLite, TopicLite } from "@/lib/library/suggest";
import { retryIndexing, type Step } from "@/lib/library/upload";

export type DocRow = {
  id: string;
  title: string;
  original_filename: string;
  uploader_id: string | null;
  uploader_name?: string | null;
  file_path: string | null;
  file_size: number;
  visibility: "shared" | "private";
  status: "active" | "archived";
  processing: "uploading" | "processing" | "ready" | "failed";
  processing_error: string | null;
  subject_id: string | null;
  topic_id: string | null;
  source_type: string;
  allow_download: boolean;
  chunk_count: number;
  page_count: number | null;
  created_at: string;
};

type Mode = "admin" | "mine" | "shared";

type Props = {
  docs: DocRow[];
  mode: Mode;
  subjects: SubjectLite[];
  topics: TopicLite[];
  currentUserId: string;
  emptyTitle: string;
  emptyText: React.ReactNode;
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function EditDialog({ doc, subjects, topics, onClose }: { doc: DocRow; subjects: SubjectLite[]; topics: TopicLite[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [subjectId, setSubjectId] = useState(doc.subject_id ?? "");
  const [topicId, setTopicId] = useState(doc.topic_id ?? "");
  const [sourceType, setSourceType] = useState(doc.source_type);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit document">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex justify-between">
          <h2 className="text-lg font-semibold">Edit details</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-mira-muted hover:bg-mira-page">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            Subject
            <select value={subjectId} onChange={(e) => (setSubjectId(e.target.value), setTopicId(""))} className={inputClass}>
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.title.length > 60 ? `${s.title.slice(0, 60)}…` : s.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Topic
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={inputClass} disabled={!subjectId}>
              <option value="">No specific topic</option>
              {subjectTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Source type
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass}>
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {result && !result.ok && <p className="text-sm text-mira-danger">{result.message}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={buttonClass("secondary", "flex-1")}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateDocument(doc.id, { title, subject_id: subjectId || null, topic_id: topicId || null, source_type: sourceType });
                  setResult(r);
                  if (r.ok) {
                    onClose();
                    router.refresh();
                  }
                })
              }
              className={buttonClass("primary", "flex-1")}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({ docs, subjects, onClose }: { docs: DocRow[]; subjects: SubjectLite[]; onClose: (deleted: boolean) => void }) {
  const [sure, setSure] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const recover = docs.reduce((n, d) => n + (d.file_path ? d.file_size : 0), 0);
  const parts = docs.reduce((n, d) => n + d.chunk_count, 0);
  const subjectCodes = [...new Set(docs.map((d) => subjects.find((s) => s.id === d.subject_id)?.code ?? "No subject"))];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Delete permanently">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-mira-danger">Delete permanently?</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium">{docs.length === 1 ? "This document" : `These ${docs.length} documents`} will be deleted:</p>
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-mira-muted">
              {docs.map((d) => (
                <li key={d.id}>{d.title}</li>
              ))}
            </ul>
          </div>
          <p>
            <span className="font-medium">Subjects:</span> {subjectCodes.join(", ")}
          </p>
          <p>
            <span className="font-medium">Storage recovered:</span> {formatBytes(recover)}
          </p>
          <p className="rounded-lg bg-red-50 px-3 py-2 text-mira-danger">
            The original files <strong>and</strong> their extracted text and search index ({parts} parts) will be deleted. Nurse Mira
            will no longer use them in new answers. This can&apos;t be undone.
          </p>
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-4 w-4 accent-mira-danger" />
            I understand this is permanent.
          </label>
          {result && !result.ok && <p className="text-mira-danger">{result.message}</p>}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => onClose(false)} className={buttonClass("secondary", "flex-1")}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!sure || pending}
            onClick={() =>
              start(async () => {
                const r = await deleteDocuments(docs.map((d) => d.id));
                setResult(r);
                if (r.ok) onClose(true);
              })
            }
            className={buttonClass("danger", "flex-1 !bg-mira-danger !text-white")}
          >
            <Trash2 size={16} aria-hidden /> {pending ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentList({ docs, mode, subjects, topics, currentUserId, emptyTitle, emptyText }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [deleting, setDeleting] = useState<DocRow[] | null>(null);
  const [message, setMessage] = useState<Result | null>(null);
  const [retrying, setRetrying] = useState<Record<string, Step | "error">>({});
  const [pending, start] = useTransition();
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const isAdmin = mode === "admin";
  const selectedDocs = docs.filter((d) => selected.has(d.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setMessage(r);
      if (r.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  async function download(doc: DocRow) {
    if (!doc.file_path) return;
    const { data, error } = await createClient().storage.from("documents").createSignedUrl(doc.file_path, 60, { download: doc.original_filename });
    if (error || !data) {
      setMessage({ ok: false, message: "This file can't be downloaded." });
      return;
    }
    window.location.href = data.signedUrl;
  }

  async function retry(doc: DocRow) {
    setRetrying((r) => ({ ...r, [doc.id]: { label: "Starting" } }));
    try {
      await retryIndexing(doc.id, (s) => setRetrying((r) => ({ ...r, [doc.id]: s })));
      setMessage({ ok: true, message: `“${doc.title}” is ready.` });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, message: (e as Error).message });
      setRetrying((r) => ({ ...r, [doc.id]: "error" }));
      router.refresh();
    }
  }

  if (docs.length === 0) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;

  return (
    <div>
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-mira-blue-soft px-4 py-3 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button type="button" disabled={pending} onClick={() => run(() => setArchived([...selected], true))} className={buttonClass("secondary", "!py-1.5")}>
            <Archive size={15} aria-hidden /> Archive
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => setArchived([...selected], false))} className={buttonClass("secondary", "!py-1.5")}>
            <ArchiveRestore size={15} aria-hidden /> Restore
          </button>
          <button type="button" disabled={pending} onClick={() => setDeleting(selectedDocs)} className={buttonClass("danger", "!py-1.5")}>
            <Trash2 size={15} aria-hidden /> Delete…
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-mira-muted underline">
            Clear selection
          </button>
        </div>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-mira-danger"}`}>
          {message.ok ? "✓ " : ""}
          {message.message}
        </p>
      )}

      <ul className="divide-y divide-mira-line">
        {docs.map((d) => {
          const subject = d.subject_id ? subjectById.get(d.subject_id) : undefined;
          const topic = d.topic_id ? topicById.get(d.topic_id) : undefined;
          const own = d.uploader_id === currentUserId;
          const p = PROCESSING_LABEL[d.processing];
          const r = retrying[d.id];
          const canDownload =
            !!d.file_path && (own || (isAdmin && d.visibility === "shared") || (d.allow_download && d.status === "active"));
          return (
            <li key={d.id} className="flex flex-wrap items-start gap-3 py-3">
              {isAdmin && (
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  aria-label={`Select ${d.title}`}
                  className="mt-1.5 h-4 w-4 accent-mira-blue"
                />
              )}
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${d.visibility === "shared" ? "bg-mira-blue-soft text-mira-blue" : "bg-gray-100 text-mira-muted"}`}>
                {d.visibility === "shared" ? <Globe2 size={18} aria-label="Shared" /> : <Lock size={18} aria-label="Private" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.title}</p>
                <p className="text-sm text-mira-muted">
                  {subject ? `${subject.code}` : "No subject"}
                  {topic ? ` · ${topic.name}` : ""} · {sourceLabel(d.source_type)} · {formatBytes(d.file_size)}
                  {d.page_count ? ` · ${d.page_count} pages` : ""} · {when(d.created_at)}
                  {isAdmin && ` · by ${d.uploader_name ?? "former student"}`}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={p.tone}>{p.label}</Badge>
                  {d.visibility === "private" && <Badge tone="gray">Private</Badge>}
                  {d.status === "archived" && <Badge tone="yellow">Archived</Badge>}
                  {d.visibility === "shared" && !d.file_path && <Badge tone="gray">Text only</Badge>}
                  {d.visibility === "shared" && d.allow_download && d.file_path && <Badge tone="blue">Download allowed</Badge>}
                </div>
                {d.processing === "failed" && d.processing_error && (!r || r === "error") && (
                  <p className="mt-1.5 text-sm text-mira-danger">{d.processing_error}</p>
                )}
                {r && r !== "error" && (
                  <p className="mt-1.5 text-sm text-mira-muted" role="status">
                    {r.label}
                    {r.total ? ` — ${r.done} of ${r.total}` : "…"}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(own || isAdmin) && (d.processing === "failed" || d.processing === "processing") && (!r || r === "error") && (
                  <button type="button" onClick={() => retry(d)} className={buttonClass("secondary", "!px-3 !py-1.5")}>
                    <RotateCw size={15} aria-hidden /> Retry
                  </button>
                )}
                {canDownload && (
                  <button type="button" onClick={() => download(d)} className="rounded-lg p-2 text-mira-muted hover:bg-mira-page hover:text-mira-ink" aria-label={`Download ${d.title}`} title="Download original">
                    <Download size={17} />
                  </button>
                )}
                {(own || isAdmin) && (
                  <button type="button" onClick={() => setEditing(d)} className="rounded-lg p-2 text-mira-muted hover:bg-mira-page hover:text-mira-ink" aria-label={`Edit ${d.title}`} title="Edit details">
                    <Pencil size={17} />
                  </button>
                )}
                {isAdmin && d.visibility === "shared" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setArchived([d.id], d.status === "active"))}
                    className="rounded-lg p-2 text-mira-muted hover:bg-mira-page hover:text-mira-ink"
                    aria-label={d.status === "active" ? `Archive ${d.title}` : `Restore ${d.title}`}
                    title={d.status === "active" ? "Archive" : "Restore"}
                  >
                    {d.status === "active" ? <Archive size={17} /> : <ArchiveRestore size={17} />}
                  </button>
                )}
                {isAdmin && d.visibility === "shared" && d.file_path && (
                  <label className="ml-1 flex items-center gap-1.5 text-xs text-mira-muted" title="Let students download the original file">
                    <input
                      type="checkbox"
                      checked={d.allow_download}
                      disabled={pending}
                      onChange={(e) => run(() => setAllowDownload(d.id, e.target.checked))}
                      className="h-4 w-4 accent-mira-blue"
                    />
                    Downloads
                  </label>
                )}
                {(own || isAdmin) && (
                  <button type="button" onClick={() => setDeleting([d])} className="rounded-lg p-2 text-mira-muted hover:bg-red-50 hover:text-mira-danger" aria-label={`Delete ${d.title}`} title="Delete permanently">
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && <EditDialog doc={editing} subjects={subjects} topics={topics} onClose={() => setEditing(null)} />}
      {deleting && (
        <DeleteDialog
          docs={deleting}
          subjects={subjects}
          onClose={(deleted) => {
            setDeleting(null);
            if (deleted) {
              setMessage({ ok: true, message: "Deleted permanently." });
              setSelected(new Set());
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
