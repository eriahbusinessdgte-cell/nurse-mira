"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Stethoscope } from "lucide-react";
import { SubjectPicker } from "@/components/subject-picker";
import { buttonClass, inputClass } from "@/components/ui";
import type { Subject } from "@/lib/curriculum";
import { firstName } from "@/lib/greeting";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { completeOnboarding } from "./actions";

type Props = {
  profile: { full_name: string; preferred_name: string; year_level: number | null; current_semester: number | null };
  subjects: Subject[];
  chosen: string[];
};

const STEPS = ["About you", "Year level", "Semester", "Subjects", "All set"];

function Choice({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
        selected ? "border-mira-blue bg-mira-blue-soft" : "border-mira-line bg-white hover:border-mira-blue/40"
      }`}
    >
      <span>
        <span className="block font-medium">{title}</span>
        {hint && <span className="block text-sm text-mira-muted">{hint}</span>}
      </span>
      {selected && <Check size={20} className="text-mira-blue" aria-hidden />}
    </button>
  );
}

export function Onboarding({ profile, subjects, chosen }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(profile.full_name);
  const [preferred, setPreferred] = useState(profile.preferred_name);
  const [year, setYear] = useState<number | null>(profile.year_level);
  const [sem, setSem] = useState<number | null>(profile.current_semester);
  const [selected, setSelected] = useState<string[]>(chosen);
  const [touchedSubjects, setTouchedSubjects] = useState(chosen.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = firstName(fullName, preferred);

  // When reaching the subjects step for the first time, tick the subjects of
  // the chosen year and semester as a starting point.
  const goToSubjects = () => {
    if (!touchedSubjects && year && sem) {
      setSelected(subjects.filter((s) => s.year_level === year && s.semester === sem).map((s) => s.id));
      setTouchedSubjects(true);
    }
    setStep(3);
  };

  const canNext = [fullName.trim().length > 0, year !== null, sem !== null, selected.length > 0, true][step];

  const next = () => {
    setError(null);
    if (step === 2) return goToSubjects();
    if (step === 3) {
      startTransition(async () => {
        const res = await completeOnboarding({
          full_name: fullName,
          preferred_name: preferred,
          year_level: year!,
          current_semester: sem!,
          subject_ids: selected,
        });
        if (!res.ok) return setError(res.message);
        setStep(4);
      });
      return;
    }
    setStep(step + 1);
  };

  return (
    <main className="flex flex-1 justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mira-blue text-white">
            <Stethoscope size={20} aria-hidden />
          </span>
          <span className="font-semibold">Nurse Mira</span>
        </div>

        {/* Progress */}
        <ol className="mb-6 flex gap-2" aria-label="Setup progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-mira-blue" : "bg-mira-line"}`} />
              <span className={`mt-1 hidden text-xs sm:block ${i === step ? "font-medium text-mira-ink" : "text-mira-muted"}`}>{label}</span>
            </li>
          ))}
        </ol>
        <p className="sr-only" aria-live="polite">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-mira-line sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Welcome to Nurse Mira!</h1>
              <p className="text-mira-muted">Let&apos;s set up your study dashboard. It takes about a minute.</p>
              <label className="block text-sm font-medium">
                Full name
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} autoComplete="name" />
              </label>
              <label className="block text-sm font-medium">
                What should we call you? <span className="font-normal text-mira-muted">(optional)</span>
                <input value={preferred} onChange={(e) => setPreferred(e.target.value)} className={inputClass} placeholder="e.g. Ana" />
              </label>
              {name && (
                <p className="rounded-lg bg-mira-blue-soft px-3 py-2 text-sm text-mira-blue-dark">
                  Nurse Mira will greet you as <strong>Nurse {name}</strong>.
                </p>
              )}
              <p className="text-xs text-mira-muted">
                Privacy: your notes, chats, case studies and results are private to you. Nurse Mira only keeps what it needs to support
                your studies. Never enter real patient names or identifying details.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold">What year are you in?</h1>
              {[1, 2, 3, 4].map((y) => (
                <Choice key={y} selected={year === y} onClick={() => setYear(y)} title={YEAR_LABEL[y]} />
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold">Which semester are you in now?</h1>
              {[1, 2].map((s) => (
                <Choice key={s} selected={sem === s} onClick={() => setSem(s)} title={SEM_LABEL[s]} />
              ))}
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-2xl font-semibold">Choose your current subjects</h1>
              <p className="mb-5 mt-1 text-sm text-mira-muted">
                We&apos;ve ticked the usual subjects for your semester. Taking subjects from another year? Just tick them too — irregular
                loads are fine.
              </p>
              <SubjectPicker subjects={subjects} selected={selected} onChange={setSelected} highlight={{ year, semester: sem }} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-mira-success">
                <Check size={28} aria-hidden />
              </span>
              <h1 className="text-2xl font-semibold">You&apos;re all set, Nurse {name}!</h1>
              <p className="text-mira-muted">
                {YEAR_LABEL[year ?? 0]} · {SEM_LABEL[sem ?? 0]} · {selected.length} subject{selected.length === 1 ? "" : "s"}. You can change these
                any time in My Subjects and Profile.
              </p>
              <button
                type="button"
                onClick={() => {
                  router.replace("/dashboard");
                  router.refresh();
                }}
                className={buttonClass("accent", "w-full sm:w-auto")}
              >
                Go to my dashboard
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
              {error}
            </p>
          )}

          {step < 4 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              {step > 0 ? (
                <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("secondary")}>
                  <ChevronLeft size={16} aria-hidden /> Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" disabled={!canNext || pending} onClick={next} className={buttonClass("primary")}>
                {pending ? "Saving…" : step === 3 ? "Finish setup" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
