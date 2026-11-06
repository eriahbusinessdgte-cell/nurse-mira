"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { SetupLinkBox } from "@/components/setup-link-box";
import { buttonClass, inputClass } from "@/components/ui";
import { adminUsers } from "@/lib/admin-users";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";

export function InviteStudent({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; name: string } | null>(null);

  const close = () => {
    setOpen(false);
    setError(null);
    setResult(null);
    if (result) router.refresh();
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const name = String(form.get("full_name") ?? "").trim();
    const { data, error: err } = await adminUsers<{ link: string }>({
      action: "invite",
      email: form.get("email"),
      full_name: name,
      year_level: Number(form.get("year_level")) || null,
      current_semester: Number(form.get("current_semester")) || null,
    });
    setBusy(false);
    if (err || !data) return setError(err ?? "Something went wrong.");
    setResult({ link: data.link, name });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("accent")}>
        <Plus size={18} aria-hidden /> Invite student
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="invite-title">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="invite-title" className="text-lg font-semibold">
                {result ? "Invitation ready" : "Invite a student"}
              </h2>
              <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1 text-mira-muted hover:bg-mira-page">
                <X size={20} />
              </button>
            </div>

            {result ? (
              <>
                <p className="mb-4 text-sm text-green-700">✓ {result.name}&apos;s account was created. Send them this setup link:</p>
                <SetupLinkBox link={result.link} name={result.name} kind="setup" />
                <button type="button" onClick={close} className={buttonClass("secondary", "mt-5 w-full")}>
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block text-sm font-medium">
                  Student&apos;s full name
                  <input name="full_name" required autoComplete="off" className={inputClass} placeholder="e.g. Ana Reyes" />
                </label>
                <label className="block text-sm font-medium">
                  Email address
                  <input name="email" type="email" required autoComplete="off" className={inputClass} placeholder="ana@example.com" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Year level <span className="font-normal text-mira-muted">(optional)</span>
                    <select name="year_level" className={inputClass} defaultValue="">
                      <option value="">Let them choose</option>
                      {[1, 2, 3, 4].map((y) => (
                        <option key={y} value={y}>
                          {YEAR_LABEL[y]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Semester <span className="font-normal text-mira-muted">(optional)</span>
                    <select name="current_semester" className={inputClass} defaultValue="">
                      <option value="">Let them choose</option>
                      {[1, 2].map((s) => (
                        <option key={s} value={s}>
                          {SEM_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-mira-muted">
                  No email is sent automatically. You&apos;ll get a one-time setup link to send the student yourself. You never see their password.
                </p>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className={buttonClass("primary", "w-full")}>
                  {busy ? "Creating account…" : "Create account and get setup link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
