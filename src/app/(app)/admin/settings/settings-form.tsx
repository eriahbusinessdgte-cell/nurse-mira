"use client";

import { useState, useTransition } from "react";
import { Coffee, Save, Stethoscope } from "lucide-react";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { DEFAULTS, LIMITS, checkSettings, pagesFor, shareFor, type AppSettings } from "@/lib/settings";
import { saveSettings, type SaveResult } from "./actions";

export function SettingsForm({ initial, activeStudents }: { initial: AppSettings; activeStudents: number }) {
  const [pool, setPool] = useState(String(initial.daily_answer_pool));
  const [minimum, setMinimum] = useState(String(initial.daily_answer_minimum));
  const [pages, setPages] = useState(String(initial.page_reading_budget));
  const [mode, setMode] = useState(initial.default_tutor_mode);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  const values = { daily_answer_pool: pool, daily_answer_minimum: minimum, page_reading_budget: pages, default_tutor_mode: mode };
  const checked = checkSettings(values);
  const p = Number(pool) || 0;
  const m = Number(minimum) || 0;
  const units = Number(pages.replace(/,/g, "")) || 0;
  const share = shareFor(p, m, activeStudents);

  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        start(async () => setResult(await saveSettings(values)));
      }}
    >
      <Card>
        <h2 className="font-semibold">AI answers per day</h2>
        <p className="mt-1 text-sm text-mira-muted">
          Every AI tool (tutor, study sheets, quizzes, case studies, care plans) uses one answer. The pool is shared equally among active
          students, and nobody gets fewer than the minimum.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Daily pool for everyone
            <input inputMode="numeric" value={pool} onChange={(e) => setPool(e.target.value)} className={`${inputClass} mt-1`} />
            <span className="mt-1 block text-xs font-normal text-mira-muted">
              {LIMITS.pool.min}–{LIMITS.pool.max}. Default {DEFAULTS.daily_answer_pool}.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Minimum per student
            <input inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value)} className={`${inputClass} mt-1`} />
            <span className="mt-1 block text-xs font-normal text-mira-muted">
              {LIMITS.minimum.min}–{LIMITS.minimum.max}. Default {DEFAULTS.daily_answer_minimum}.
            </span>
          </label>
        </div>
        <p className="mt-3 rounded-xl bg-mira-blue-soft p-3 text-sm">
          With {activeStudents} active student{activeStudents === 1 ? "" : "s"}, each can get <strong>{share}</strong> answer{share === 1 ? "" : "s"} a day.
        </p>
        {p > LIMITS.pool.comfortable && (
          <p className="mt-2 text-sm text-amber-700">
            Above {LIMITS.pool.comfortable}, the free AI services may run out before the day ends. Students would then see &ldquo;AI is busy, try again
            later&rdquo; until 8:00 AM, even if they still have answers left.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Handwriting reading per day</h2>
        <p className="mt-1 text-sm text-mira-muted">
          Photographed pages are read by Cloudflare&apos;s free AI, which allows 10,000 units a day for the whole app (resets 8:00 AM). Whatever
          pages don&apos;t use stays available as the AI Tutor&apos;s backup when Groq is busy.
        </p>
        <label className="mt-4 block text-sm font-medium sm:max-w-xs">
          Units for reading pages
          <input inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value)} className={`${inputClass} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-mira-muted">
            0–{LIMITS.pages.max.toLocaleString()}. Default {DEFAULTS.page_reading_budget.toLocaleString()}.
          </span>
        </label>
        <p className="mt-3 rounded-xl bg-mira-blue-soft p-3 text-sm">
          {units <= 0 ? (
            <>Handwriting reading is off — photo pages will use the simpler built-in reader, which can&apos;t read handwriting.</>
          ) : (
            <>
              About <strong>{pagesFor(units).toLocaleString()}</strong> pages a day, leaving about {Math.max(0, 9700 - units).toLocaleString()} units for
              the tutor backup.
            </>
          )}
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">AI Tutor starting mode</h2>
        <p className="mt-1 text-sm text-mira-muted">The mode a new chat starts in. Students can still switch at any time; safety topics always use Clinical Mode.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Starting mode">
          {(
            [
              ["tea", "Tea Mode", "Friendly and relaxed", Coffee],
              ["clinical", "Clinical Mode", "Formal and exam-ready", Stethoscope],
            ] as const
          ).map(([value, label, hint, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 ${mode === value ? "bg-mira-blue-soft ring-2 ring-mira-blue" : "ring-mira-line hover:bg-mira-page"}`}
            >
              <Icon size={20} className="text-mira-blue" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-mira-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !checked.ok} className={buttonClass("primary")}>
          <Save size={16} aria-hidden /> {pending ? "Saving…" : "Save settings"}
        </button>
        {!checked.ok && <p className="text-sm text-mira-danger">{checked.message}</p>}
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700" : "text-mira-danger"}`}>
            {result.ok ? "✓ " : ""}
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
