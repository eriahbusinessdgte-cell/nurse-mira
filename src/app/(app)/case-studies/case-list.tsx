"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, FileHeart, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { buttonClass, Card, EmptyState } from "@/components/ui";
import { createCaseStudy, deleteCaseStudy, duplicateCaseStudy } from "./actions";

type Row = { id: string; title: string; subject_id: string | null; updated_at: string; sections: number; filled: number; missing: number };

export function CaseList({ cases, subjects }: { cases: Row[]; subjects: { id: string; code: string; title: string }[] }) {
  const [list, setList] = useState(cases);
  const [pending, startTransition] = useTransition();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mira-blue text-white">
            <FileHeart size={24} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">Case Study Builder</h1>
            <p className="mt-1 max-w-2xl text-sm text-mira-muted">
              Enter your patient&apos;s case information (without names), then write each section yourself or let Nurse Mira draft it. The AI never invents
              patient data — anything missing is marked <span className="rounded bg-amber-100 px-1 text-amber-900">[MISSING]</span> for you to fill in. Your case
              studies are private.
            </p>
          </div>
          <form action={createCaseStudy}>
            <button type="submit" className={buttonClass("accent")} disabled={pending}>
              <Plus size={18} aria-hidden /> New case study
            </button>
          </form>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-mira-blue-soft px-3 py-2 text-xs text-mira-blue-dark">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
          Never enter real names, initials that identify someone, hospital or record numbers, addresses, phone numbers or exact birthdates. Use “Patient A”.
        </p>
      </Card>

      {list.length === 0 ? (
        <EmptyState title="No case studies yet">Click “New case study” to start your first one.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => {
            const subject = c.subject_id ? subjectById.get(c.subject_id) : undefined;
            return (
              <li key={c.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mira-line">
                <Link href={`/case-studies/${c.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold hover:text-mira-blue">{c.title}</p>
                  <p className="text-xs text-mira-muted">
                    {subject ? `${subject.title} · ` : ""}
                    {c.filled}/{c.sections} sections written
                    {c.missing ? ` · ${c.missing} missing item${c.missing === 1 ? "" : "s"}` : ""} · edited{" "}
                    {new Date(c.updated_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                  </p>
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  title="Duplicate"
                  onClick={() => startTransition(async () => void (await duplicateCaseStudy(c.id), location.reload()))}
                  className="rounded-lg p-2 text-mira-muted hover:bg-mira-page hover:text-mira-ink"
                  aria-label={`Duplicate ${c.title}`}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  title="Delete"
                  onClick={() =>
                    confirm(`Delete “${c.title}”? This can't be undone.`) &&
                    startTransition(async () => {
                      if ((await deleteCaseStudy(c.id)).ok) setList((l) => l.filter((x) => x.id !== c.id));
                    })
                  }
                  className="rounded-lg p-2 text-mira-muted hover:bg-red-50 hover:text-mira-danger"
                  aria-label={`Delete ${c.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
