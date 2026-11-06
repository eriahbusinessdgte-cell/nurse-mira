"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Card, buttonClass } from "@/components/ui";
import { reportProblem } from "@/lib/report-problem";

// Shown if a page breaks unexpectedly. The admin's Problems list gets a short note.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const e = error as { message?: string; digest?: string } | null;
    reportProblem("page", "crash", e?.digest ? `Server error ${e.digest}` : (e?.message ?? "Unknown error").slice(0, 200));
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-lg font-semibold">This page hit a problem</h1>
      <p className="mt-2 text-sm text-mira-muted">Nothing you saved was lost. Please try again — if it keeps happening, let your admin know.</p>
      <button type="button" onClick={() => retry()} className={buttonClass("primary", "mt-4")}>
        <RotateCcw size={16} aria-hidden /> Try again
      </button>
    </Card>
  );
}
