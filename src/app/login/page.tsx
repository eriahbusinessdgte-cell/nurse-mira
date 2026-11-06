import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Nurse Mira" };

const NOTICES: Record<string, string> = {
  inactive: "This account is turned off. Please contact your Nurse Mira administrator.",
  signedout: "You've been signed out.",
  linkexpired: "That link has expired or was already used. Ask your administrator for a new one.",
};

async function LoginContent({ searchParams }: PageProps<"/login">) {
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-mira-blue text-2xl font-semibold text-white">
            M
          </div>
          <h1 className="text-2xl font-semibold">Nurse Mira</h1>
          <p className="mt-1 text-sm text-mira-muted">Your Personal Nursing School Companion</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-mira-line">
          {message && (
            <p role="status" className="mb-4 rounded-lg bg-mira-blue-soft px-3 py-2 text-sm text-mira-blue-dark">
              {message}
            </p>
          )}
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-mira-muted">
          Nurse Mira is invite-only. Forgot your password? Ask your administrator for a reset link.
        </p>
      </div>
    </main>
  );
}

export default function Page(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<PageLoading label="Loading…" />}>
      <LoginContent {...props} />
    </Suspense>
  );
}
