"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardPaste,
  FileHeart,
  FileUp,
  Loader2,
  ShieldCheck,
  SpellCheck,
  Trash2,
} from "lucide-react";
import { Badge, buttonClass, Card, inputClass } from "@/components/ui";
import { Mira } from "@/components/mira";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { ACCEPT_ATTR, extractText } from "@/lib/library/extract";
import { findIdentifiers } from "@/lib/case/facts";

export type PastCheck = {
  id: string;
  title: string;
  status: "checking" | "ready";
  format: string;
  created_at: string;
  saved_case_study_id: string | null;
};
type Source = "upload" | "pasted" | "case_study";

export async function invokeCheck(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("case-check", {
    body,
  });
  if (error || !data || data.error) {
    let message = data?.error as string | undefined;
    if (!message && error) {
      try {
        message = (await (error as { context?: Response }).context?.json())
          ?.error;
      } catch {
        /* ignore */
      }
    }
    if (!["limit", "busy", "invalid"].includes(data?.kind))
      reportProblem("case-check", problemKind(data, !!error), message);
    return {
      ok: false as const,
      kind: (data?.kind as string) ?? "unreachable",
      retryAfter: Number(data?.retry_after) || 0,
      message:
        message ??
        "Nurse Mira couldn't be reached. Check your internet and try again.",
    };
  }
  return { ok: true as const, data };
}

export function CheckHome({
  cases,
  checks: initialChecks,
  remaining,
  preselect,
}: {
  cases: { id: string; title: string }[];
  checks: PastCheck[];
  remaining: number;
  preselect: string | null;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState(initialChecks);
  const [source, setSource] = useState<Source>(
    preselect && cases.some((c) => c.id === preselect)
      ? "case_study"
      : "upload",
  );
  const [caseId, setCaseId] = useState(
    preselect && cases.some((c) => c.id === preselect)
      ? preselect
      : (cases[0]?.id ?? ""),
  );
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [upload, setUpload] = useState<{ name: string; text: string } | null>(
    null,
  );
  const [reading, setReading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text =
    source === "upload"
      ? (upload?.text ?? "")
      : source === "pasted"
        ? pasted
        : "";
  const identifiers = text ? findIdentifiers(text) : [];
  const [deidentified, setDeidentified] = useState(false);
  const pages = Math.max(1, Math.round(text.length / 2400));

  async function readFile(file: File) {
    setError(null);
    setUpload(null);
    setReading("Reading the file…");
    try {
      const out = await extractText(file, (m) => setReading(m));
      const t = out.pages
        .map((p) => p.text)
        .join("\n\n")
        .trim();
      if (t.replace(/\s/g, "").length < 300) {
        setError(
          out.unreadablePages.length
            ? "Nurse Mira couldn't read enough of this file (some pages look like unclear pictures). Try the Word version, or paste the text."
            : "Nurse Mira could only read a little text from this file. Try the Word version, or paste the text.",
        );
      } else {
        setUpload({ name: file.name, text: t });
        if (!title)
          setTitle(
            file.name
              .replace(/\.[a-z0-9]+$/i, "")
              .replace(/[_-]+/g, " ")
              .slice(0, 120),
          );
        if (out.unreadablePages.length)
          setError(
            `Note: ${out.unreadablePages.length} page${out.unreadablePages.length > 1 ? "s" : ""} looked like pictures (e.g. a table saved as an image) and couldn't be read, so ${out.unreadablePages.length > 1 ? "they" : "it"} won't be checked.`,
          );
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "This file couldn't be read. Try another file, or paste the text.",
      );
    }
    setReading(null);
  }

  async function start() {
    setError(null);
    if (source === "case_study" && !caseId)
      return setError("Choose one of your case studies first.");
    if (source === "upload" && !upload) return setError("Choose a file first.");
    if (source !== "case_study" && text.replace(/\s/g, "").length < 300)
      return setError(
        "There's too little text to check. Add more of your case study.",
      );
    if (source !== "case_study" && !deidentified)
      return setError(
        "Please tick the box to confirm real names, exact addresses and workplaces are removed.",
      );
    setBusy(true);
    const r = await invokeCheck(
      source === "case_study"
        ? { action: "start", source, case_study_id: caseId }
        : { action: "start", source, text, title: title.trim(), deidentified },
    );
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    router.push(`/case-studies/check/${r.data.id}`);
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        "Delete this check? Your own case study files aren't touched.",
      )
    )
      return;
    const { error: e } = await createClient()
      .from("case_checks")
      .delete()
      .eq("id", id);
    if (e) return setError("That check couldn't be deleted. Please try again.");
    setChecks((l) => l.filter((c) => c.id !== id));
  }

  const tab = (s: Source, label: string, Icon: typeof FileUp) => (
    <button
      type="button"
      onClick={() => (setSource(s), setError(null))}
      aria-pressed={source === s}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ${source === s ? "bg-mira-blue text-white ring-mira-blue" : "bg-white ring-mira-line hover:bg-mira-blue-soft"}`}
    >
      <Icon size={16} aria-hidden /> {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/case-studies"
        className="inline-flex items-center gap-1.5 text-sm text-mira-blue hover:underline"
      >
        <ArrowLeft size={16} aria-hidden /> Case studies
      </Link>
      <Card>
        <div className="flex items-start gap-4">
          <Mira
            pose="thinking"
            height={90}
            className="hidden shrink-0 sm:block"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">Case Study Checker</h1>
            <p className="mt-1 text-sm text-mira-muted">
              Import a case study you wrote. Nurse Mira checks it and makes
              light improvements — fixing errors, unclear parts and incomplete
              items — while keeping your structure and your words. You&apos;ll
              see every change and why, and you can save the improved version as
              a new case study. Your original isn&apos;t changed.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {tab("upload", "Upload a file", FileUp)}
          {tab("pasted", "Paste it", ClipboardPaste)}
          {tab("case_study", "My case studies", FileHeart)}
        </div>

        <div className="mt-4">
          {source === "upload" && (
            <div>
              <label className={buttonClass("secondary", "cursor-pointer")}>
                <FileUp size={16} aria-hidden /> Choose file
                <input
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="sr-only"
                  onChange={(e) =>
                    e.target.files?.[0] && readFile(e.target.files[0])
                  }
                />
              </label>
              <p className="mt-1 text-xs text-mira-muted">
                Word, PDF, PowerPoint or text. Up to about 25 pages per check.
                The Word version usually reads best.
              </p>
              {reading && (
                <p className="mt-2 flex items-center gap-2 text-sm text-mira-muted">
                  <Loader2 size={15} className="animate-spin" aria-hidden />{" "}
                  {reading}
                </p>
              )}
              {upload && (
                <div className="mt-3 rounded-lg bg-mira-page p-3 text-sm">
                  <p className="font-medium">
                    ✓ Read “{upload.name}” — about {pages} page
                    {pages > 1 ? "s" : ""} of text.
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-mira-blue">
                      Check what was read
                    </summary>
                    <p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-mira-muted">
                      {upload.text.slice(0, 5000)}
                      {upload.text.length > 5000 ? "…" : ""}
                    </p>
                  </details>
                </div>
              )}
            </div>
          )}
          {source === "pasted" && (
            <label className="block text-sm font-medium">
              Paste your case study
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                maxLength={60000}
                placeholder="Paste the whole case study, with its headings (Chapter 1, Introduction, Drug Study…)."
                className={inputClass}
              />
            </label>
          )}
          {source === "case_study" &&
            (cases.length ? (
              <label className="block text-sm font-medium">
                Case study
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className={inputClass}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-mira-muted">
                You don&apos;t have a saved case study yet — upload or paste one
                instead.
              </p>
            ))}
          {source !== "case_study" && (
            <label className="mt-3 block text-sm font-medium">
              Name{" "}
              <span className="font-normal text-mira-muted">(optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. CHN case presentation – Group 2"
                className={inputClass}
              />
            </label>
          )}
        </div>

        {identifiers.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              This may contain identifying details. Phone numbers, record
              numbers and emails are removed before the AI reads it, but please
              also remove real names, exact addresses and workplaces from your
              paper:
              <ul className="mt-1 list-disc pl-5">
                {identifiers.slice(0, 4).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </span>
          </p>
        )}
        {source !== "case_study" && (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={deidentified}
              onChange={(e) => setDeidentified(e.target.checked)}
              className="mt-1"
            />
            <span>
              I removed real names, exact addresses (house, street, barangay),
              workplaces and other details that could identify the patient or
              family. <span className="text-mira-muted">Nurse Mira&apos;s AI
              reads this text.</span>
            </span>
          </label>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-mira-danger"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{" "}
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={busy || !!reading}
            className={buttonClass("accent", "!px-5 !py-3 text-base")}
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <SpellCheck size={18} aria-hidden />
            )}{" "}
            Check my case study
          </button>
          <p className="text-xs text-mira-muted">
            Uses about 1 AI answer per 2–3 pages
            {text
              ? ` (about ${Math.ceil(text.length / 6000) + 1} for this one)`
              : ""}
            . You have {remaining} left today.
          </p>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">My checks</h2>
        {checks.length === 0 ? (
          <p className="mt-2 text-sm text-mira-muted">
            No checks yet. Each check is saved here so you can come back to it.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {checks.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-mira-line"
              >
                <Link
                  href={`/case-studies/check/${c.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-medium hover:text-mira-blue">{c.title}</p>
                  <p className="text-xs text-mira-muted">
                    {new Date(c.created_at).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    ·{" "}
                    {c.format === "chn"
                      ? "CHN family case"
                      : "Hospital case study"}
                  </p>
                </Link>
                {c.status === "checking" ? (
                  <Badge tone="yellow">Not finished</Badge>
                ) : c.saved_case_study_id ? (
                  <Badge tone="green">Saved as case study</Badge>
                ) : (
                  <Badge tone="blue">Ready</Badge>
                )}
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="rounded-lg p-2 text-mira-muted hover:bg-red-50 hover:text-mira-danger"
                  aria-label={`Delete check ${c.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
