"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Please try again.";
  if (m.includes("email not confirmed")) return "Your account isn't set up yet. Open the setup link your administrator sent you.";
  if (m.includes("fetch") || m.includes("network")) return "Can't reach Nurse Mira right now. Check your internet and try again.";
  return "Something went wrong signing in. Please try again in a moment.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(friendlyError(signInError.message));
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const input =
    "mt-1 w-full rounded-lg border border-mira-line bg-white px-3 py-2.5 text-mira-ink outline-none focus:border-mira-blue focus:ring-2 focus:ring-mira-blue/20";

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block text-sm font-medium">
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mira-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !email || !password}
        className="w-full rounded-lg bg-mira-blue px-4 py-2.5 font-medium text-white transition hover:bg-mira-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
