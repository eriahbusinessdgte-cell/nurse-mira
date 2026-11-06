"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { groupSubjects, type Subject } from "@/lib/curriculum";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";

type Props = {
  subjects: Subject[];
  selected: string[];
  onChange: (ids: string[]) => void;
  highlight?: { year: number | null; semester: number | null };
};

// Checklist of every subject, grouped by year and semester. Students may pick
// subjects from any year (irregular loads are allowed).
export function SubjectPicker({ subjects, selected, onChange, highlight }: Props) {
  const [query, setQuery] = useState("");
  const chosen = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => `${s.code} ${s.title}`.toLowerCase().includes(q));
  }, [subjects, query]);

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mira-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a subject…"
            aria-label="Find a subject"
            className="w-full rounded-lg border border-mira-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-mira-blue"
          />
        </div>
        <p className="text-sm text-mira-muted" aria-live="polite">
          {chosen.size} selected
        </p>
      </div>

      <div className="space-y-5">
        {groupSubjects(filtered).map((g) => {
          const isCurrent = highlight?.year === g.year && highlight?.semester === g.semester;
          return (
            <fieldset key={`${g.year}-${g.semester}`}>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {YEAR_LABEL[g.year]} · {SEM_LABEL[g.semester]}
                {isCurrent && (
                  <span className="rounded-full bg-mira-yellow/30 px-2 py-0.5 text-xs font-medium text-mira-blue-dark">Your current semester</span>
                )}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.subjects.map((s) => {
                  const on = chosen.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                        on ? "border-mira-blue bg-mira-blue-soft" : "border-mira-line bg-white hover:border-mira-blue/40"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(s.id)} />
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          on ? "border-mira-blue bg-mira-blue text-white" : "border-mira-line bg-white"
                        }`}
                      >
                        {on && <Check size={14} />}
                      </span>
                      <span>
                        <span className="block font-medium">{s.code}</span>
                        <span className="block text-mira-muted">{s.title}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-mira-muted">No subjects match “{query}”.</p>}
      </div>
    </div>
  );
}
