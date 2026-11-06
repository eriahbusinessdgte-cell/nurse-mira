"use client";

import { useActionState, useState } from "react";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { firstName } from "@/lib/greeting";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { saveMyProfile } from "./actions";

type P = {
  email: string;
  full_name: string;
  preferred_name: string | null;
  role: "student" | "admin";
  year_level: number | null;
  current_semester: number | null;
};

export function ProfileForm({ profile }: { profile: P }) {
  const [result, action, pending] = useActionState(saveMyProfile, null);
  const [full, setFull] = useState(profile.full_name);
  const [pref, setPref] = useState(profile.preferred_name ?? "");
  const shown = firstName(full, pref);

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Your details</h2>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Full name
          <input name="full_name" required value={full} onChange={(e) => setFull(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          What should we call you? <span className="font-normal text-mira-muted">(optional)</span>
          <input name="preferred_name" value={pref} onChange={(e) => setPref(e.target.value)} className={inputClass} />
        </label>
        {profile.role === "student" && (
          <>
            <label className="block text-sm font-medium">
              Year level
              <select name="year_level" defaultValue={profile.year_level ?? ""} className={inputClass}>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    {YEAR_LABEL[y]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Current semester
              <select name="current_semester" defaultValue={profile.current_semester ?? ""} className={inputClass}>
                {[1, 2].map((s) => (
                  <option key={s} value={s}>
                    {SEM_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <p className="text-sm text-mira-muted sm:col-span-2">
          Greeting preview: <strong>{profile.role === "student" ? `Good morning, Nurse ${shown}` : `Good morning, ${shown}`}</strong> · Email:{" "}
          {profile.email}
        </p>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Saving…" : "Save profile"}
          </button>
          {result && (
            <span role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700" : "text-mira-danger"}`}>
              {result.ok ? "✓ " : ""}
              {result.message}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message.toLowerCase().includes("different") ? "Please choose a new password you haven't used before." : "Couldn't change your password. Please try again." });
      return;
    }
    setPw("");
    setAgain("");
    setMsg({ ok: true, text: "Password changed." });
  }

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Change password</h2>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          New password
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs text-mira-muted">At least 8 characters.</span>
        </label>
        <label className="block text-sm font-medium">
          Type it again
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputClass} />
          {again && again !== pw && <span className="mt-1 block text-xs text-mira-danger">The passwords don&apos;t match yet.</span>}
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={busy || pw.length < 8 || pw !== again} className={buttonClass("secondary")}>
            {busy ? "Saving…" : "Change password"}
          </button>
          {msg && (
            <span role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-700" : "text-mira-danger"}`}>
              {msg.ok ? "✓ " : ""}
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
