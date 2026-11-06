"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { clearProblems } from "./actions";

export function ClearProblems() {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  if (!sure)
    return (
      <button type="button" onClick={() => setSure(true)} className={buttonClass("secondary")}>
        <Trash2 size={16} aria-hidden /> Clear list
      </button>
    );
  return (
    <span className="flex items-center gap-2 text-sm">
      Clear every problem from the list?
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await clearProblems();
            setSure(false);
            router.refresh();
          })
        }
        className={buttonClass("danger")}
      >
        {pending ? "Clearing…" : "Yes, clear"}
      </button>
      <button type="button" onClick={() => setSure(false)} className={buttonClass("secondary")}>
        Cancel
      </button>
    </span>
  );
}
