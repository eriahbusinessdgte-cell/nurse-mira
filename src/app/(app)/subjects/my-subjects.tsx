"use client";

import { useState, useTransition } from "react";
import { SubjectPicker } from "@/components/subject-picker";
import { Card, buttonClass } from "@/components/ui";
import type { Subject } from "@/lib/curriculum";
import { saveMySubjects } from "./actions";

export function MySubjects({
  subjects,
  initial,
  highlight,
}: {
  subjects: Subject[];
  initial: string[];
  highlight: { year: number | null; semester: number | null };
}) {
  const [selected, setSelected] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = selected.length !== saved.length || selected.some((id) => !saved.includes(id));

  return (
    <Card>
      <SubjectPicker subjects={subjects} selected={selected} onChange={(ids) => (setSelected(ids), setResult(null))} highlight={highlight} />
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-mira-line bg-white pt-4">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveMySubjects(selected);
              setResult(res);
              if (res.ok) setSaved(selected);
            })
          }
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {dirty && !pending && <span className="text-sm text-amber-700">You have unsaved changes</span>}
        {result && (
          <span role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700" : "text-mira-danger"}`}>
            {result.ok ? "✓ " : ""}
            {result.message}
          </span>
        )}
      </div>
    </Card>
  );
}
