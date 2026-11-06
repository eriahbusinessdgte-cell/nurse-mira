"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Reached from a setup or reset link (the link signs the student in first).
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      const m = err.message.toLowerCase();
      setError(
        m.includes("session")
          ? "Your link has expired. Ask your administrator for a new one."
          : m.includes("different")
            ? "Please choose a password you haven't used before."
            : m.includes("weak") || m.includes("characters")
              ? "Please choose a stronger password (at least 8 characters, mixing letters and numbers)."
              : "Couldn't save your password. Please try again.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-mira-blue text-white">
            <Stethoscope size={28} aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">Create your password</h1>
          <p className="mt-1 text-sm text-mira-muted">You&apos;ll use it with your email to sign in to Nurse Mira.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-mira-line" noValidate>
          <label className="block text-sm font-medium">
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              aria-describedby="pw-help"
            />
            <span id="pw-help" className={`mt-1 block text-xs ${tooShort ? "text-mira-danger" : "text-mira-muted"}`}>
              At least 8 characters.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Type it again
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
            {mismatch && <span className="mt-1 block text-xs text-mira-danger">The two passwords don&apos;t match yet.</span>}
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || password.length < 8 || password !== confirm}
            className={buttonClass("primary", "w-full")}
          >
            {busy ? "Saving…" : "Save password and continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
