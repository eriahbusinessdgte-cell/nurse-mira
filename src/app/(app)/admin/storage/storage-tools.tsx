"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, FileText } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { archiveSemester, keepTextOnly, type Result } from "@/lib/library/actions";
import { formatBytes } from "@/lib/library/labels";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";

function Msg({ r }: { r: Result | null }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={`text-sm ${r.ok ? "text-green-700" : "text-mira-danger"}`}>
      {r.ok ? "✓ " : ""}
      {r.message}
    </p>
  );
}

export function ArchiveSemester() {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [sem, setSem] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year level" className={inputClass}>
          <option value="">Year…</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              {YEAR_LABEL[y]}
            </option>
          ))}
        </select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} aria-label="Semester" className={inputClass}>
          <option value="">Semester…</option>
          {[1, 2].map((s) => (
            <option key={s} value={s}>
              {SEM_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!year || !sem || pending}
        onClick={() =>
          start(async () => {
            const r = await archiveSemester(Number(year), Number(sem));
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
        className={buttonClass("secondary", "w-full")}
      >
        <Archive size={16} aria-hidden /> {pending ? "Archiving…" : "Archive this semester's materials"}
      </button>
      <Msg r={result} />
    </div>
  );
}

export function TextOnlyArchived({ ids, bytes }: { ids: string[]; bytes: number }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (!ids.length) return <p className="text-sm text-mira-muted">No archived shared files are taking up space.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {ids.length} archived shared document(s) still keep their original file, using <strong>{formatBytes(bytes)}</strong>.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-4 w-4 accent-mira-blue" />
        Remove their original files. The extracted text stays, so Nurse Mira can still use them in answers. Students won&apos;t be able
        to download these originals.
      </label>
      <button
        type="button"
        disabled={!sure || pending}
        onClick={() =>
          start(async () => {
            const r = await keepTextOnly(ids);
            setResult(r.ok && r.recovered ? { ...r, message: `${r.message} Recovered ${formatBytes(r.recovered)}.` } : r);
            if (r.ok) router.refresh();
          })
        }
        className={buttonClass("secondary", "w-full")}
      >
        <FileText size={16} aria-hidden /> {pending ? "Removing…" : "Keep text only"}
      </button>
      <Msg r={result} />
    </div>
  );
}

type ExportDoc = {
  id: string;
  title: string;
  original_filename: string;
  file_path: string | null;
  subject_id: string | null;
  topic_id: string | null;
  source_type: string;
  status: string;
  year_level: number | null;
  semester: number | null;
  created_at: string;
};

/** Builds a .zip of the shared library in the browser: details, extracted text, and original files. */
export function ExportLibrary() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withFiles, setWithFiles] = useState(true);

  async function run() {
    setError(null);
    setBusy("Collecting documents…");
    try {
      const supabase = createClient();
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const [{ data: docs }, { data: subjects }, { data: topics }] = await Promise.all([
        supabase
          .from("documents")
          .select("id, title, original_filename, file_path, subject_id, topic_id, source_type, status, year_level, semester, created_at")
          .eq("visibility", "shared")
          .order("created_at"),
        supabase.from("subjects").select("id, code, title, year_level, semester"),
        supabase.from("topics").select("id, subject_id, name"),
      ]);
      const list = (docs ?? []) as ExportDoc[];
      zip.file("subjects.json", JSON.stringify(subjects ?? [], null, 2));
      zip.file("topics.json", JSON.stringify(topics ?? [], null, 2));
      zip.file("documents.json", JSON.stringify(list, null, 2));

      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        setBusy(`Adding ${i + 1} of ${list.length}: ${d.title}`);
        const folder = zip.folder(`documents/${d.id}`)!;
        const { data: chunks } = await supabase
          .from("document_chunks")
          .select("chunk_index, page_number, content")
          .eq("document_id", d.id)
          .order("chunk_index");
        folder.file(
          "text.txt",
          (chunks ?? []).map((c) => `[part ${c.chunk_index + 1}${c.page_number ? `, page ${c.page_number}` : ""}]\n${c.content}`).join("\n\n"),
        );
        folder.file("details.json", JSON.stringify(d, null, 2));
        if (withFiles && d.file_path) {
          const { data: blob } = await supabase.storage.from("documents").download(d.file_path);
          if (blob) folder.file(d.original_filename, blob);
        }
      }
      setBusy("Creating the .zip file…");
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nurse-mira-shared-library-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setBusy(null);
    } catch {
      setBusy(null);
      setError("The export didn't finish. Please try again.");
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} className="h-4 w-4 accent-mira-blue" />
        Include original files (bigger download)
      </label>
      <button type="button" disabled={!!busy} onClick={run} className={buttonClass("primary", "w-full")}>
        <Download size={16} aria-hidden /> {busy ? "Exporting…" : "Download shared library (.zip)"}
      </button>
      {busy && (
        <p role="status" className="text-sm text-mira-muted">
          {busy}
        </p>
      )}
      {error && <p className="text-sm text-mira-danger">{error}</p>}
      <p className="text-xs text-mira-muted">
        Includes each shared document&apos;s details, its extracted text with page numbers, and the curriculum, so the library can be
        moved to another service if needed. Students&apos; private documents are not included.
      </p>
    </div>
  );
}
