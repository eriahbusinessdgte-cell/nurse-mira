import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Greeting } from "@/components/greeting";
import { SignOutButton } from "@/components/sign-out-button";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Nurse Mira" };

// Phase 2 student home. The full dashboard and onboarding arrive in Phase 3.
async function StudentDashboard() {
  const { profile } = await requireProfile("student");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-mira-blue">Nurse Mira</p>
          <Greeting person={profile} className="text-2xl font-semibold" />
        </div>
        <SignOutButton />
      </header>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-mira-line">
        <p className="text-mira-muted">Your study dashboard is being prepared. Check back soon!</p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading your dashboard…" />}>
      <StudentDashboard />
    </Suspense>
  );
}
