"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const noop = () => () => {};

// Month calendar using the viewer's own date. Planner items will appear on it later.
export function MiniCalendar() {
  const today = useSyncExternalStore(noop, () => new Date().toDateString(), () => "");
  const [offset, setOffset] = useState(0);

  if (!today) return <div className="h-64" aria-hidden />;

  const now = new Date(today);
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = (view.getDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const isToday = (d: number) => offset === 0 && d === now.getDate();
  const label = view.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-mira-page">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold" aria-live="polite">
          {label}
        </p>
        <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-mira-page">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {DAYS.map((d, i) => (
          <span key={i} className="pb-1 text-mira-muted">
            {d}
          </span>
        ))}
        {cells.map((d, i) => (
          <span key={i} className="flex justify-center">
            {d && (
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isToday(d) ? "bg-mira-blue font-semibold text-white" : "text-mira-ink"
                }`}
                aria-current={isToday(d) ? "date" : undefined}
              >
                {d}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
