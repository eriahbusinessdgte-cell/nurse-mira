"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, X } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import { readPdfText, sha256 } from "@/lib/library/extract";
import { prepareTextbookPages } from "@/lib/library/textbook";
import { importTextbook, type Step, type TextbookResult } from "@/lib/library/upload";

const titleFromFile = (name: string) =>
  name
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(web|print|optimized|\d{6,})\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Admin only: add a large, openly licensed textbook to the shared library as text. */
export function TextbookDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("OpenStax");
  const [license, setLicense] = useState("CC BY 4.0");
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<TextbookResult | null>(null);
  const busy = !!step && !done && !error;

  function close() {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setTitle("");
    setConfirmed(false);
    setStep(null);
    setError(null);
    setDone(null);
  }

  async function start() {
    if (!file) return;
    setError(null);
    setStep({ label: "Checking the file" });
    try {
      const hash = await sha256(file);
      const result = await importTextbook({ file, title, author, license, sha256: hash }, setStep, async (f, onProgress) => {
        const { pages, pageCount } = await readPdfText(f, onProgress);
        onProgress("Tidying the text (removing page headers, contents and index pages)…");
        const prepared = prepareTextbookPages(pages);
        return { pages: prepared.pages, pageCount, skipped: prepared.skipped };
      });
      setDone(result);
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "The book couldn't be added. Please try again.");
    }
  }

  const pct = step?.total ? Math.round(((step.done ?? 0) / step.total) * 100) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        <BookPlus size={18} aria-hidden /> Add textbook
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tb-title">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="tb-title" className="text-lg font-semibold">
                Add an open textbook
              </h2>
              <button type="button" onClick={close} disabled={busy} aria-label="Close" className="rounded-lg p-1 text-mira-muted hover:bg-mira-page disabled:opacity-40">
                <X size={20} />
              </button>
            </div>

            {done ? (
              <div className="space-y-3 text-sm">
                <p className="text-green-700">
                  ✓ “{title}” is in the library: {done.pieces.toLocaleString()} searchable text pieces from {done.pages.toLocaleString()} pages
                  {done.skipped ? ` (${done.skipped} contents, index or blank pages left out)` : ""}.
                </p>
                <p className="text-mira-muted">The AI Tutor can now cite it, with page numbers, for every student.</p>
                <button type="button" onClick={close} className={buttonClass("primary", "w-full")}>
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-mira-muted">
                  For big, freely licensed books (for example OpenStax nursing textbooks). Only the text and page numbers are saved, so it fits
                  the free plan — the PDF itself isn&apos;t stored and students can&apos;t download it here.
                </p>
                <label className="block text-sm font-medium">
                  Textbook PDF
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f && !title) setTitle(titleFromFile(f.name));
                    }}
                    className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mira-blue-soft file:px-3 file:py-2 file:text-mira-blue"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Book title
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={`${inputClass} mt-1`} placeholder="Fundamentals of Nursing" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Publisher / author
                    <input value={author} onChange={(e) => setAuthor(e.target.value)} disabled={busy} className={`${inputClass} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    License
                    <input value={license} onChange={(e) => setLicense(e.target.value)} disabled={busy} className={`${inputClass} mt-1`} />
                  </label>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} className="mt-1" />
                  <span>This book has an open license (such as Creative Commons) that allows sharing it with my students.</span>
                </label>

                {step && !error && (
                  <div className="rounded-xl bg-mira-blue-soft p-3 text-sm" role="status">
                    <p className="font-medium">{step.label}</p>
                    {pct !== null && (
                      <>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-mira-blue transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-mira-muted">
                          {(step.done ?? 0).toLocaleString()} of {(step.total ?? 0).toLocaleString()} · {pct}%
                        </p>
                      </>
                    )}
                    <p className="mt-2 text-xs text-mira-muted">
                      A big book takes about 45–60 minutes. Keep this tab open and your computer awake. If it stops, press Retry on the book in the
                      library to continue.
                    </p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-mira-danger">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={start}
                  disabled={!file || title.trim().length < 3 || !author.trim() || !confirmed || busy}
                  className={buttonClass("primary", "w-full")}
                >
                  <BookPlus size={16} aria-hidden /> {busy ? "Adding the book…" : "Add to the library"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
