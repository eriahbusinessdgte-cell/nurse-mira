import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Greeting } from "@/components/greeting";
import { SignOutButton } from "@/components/sign-out-button";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Admin · Nurse Mira" };

// Phase 2 admin home: confirms sign-in, role and database connection.
// The full admin area (Students, Curriculum, Shared Library, Storage, Settings) arrives in Phase 3+.
async function AdminHome() {
  const { supabase, profile } = await requireProfile("admin");

  const [{ count: studentCount }, { count: subjectCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const cards = [
    { label: "Students", value: studentCount ?? 0 },
    { label: "Subjects in the curriculum", value: subjectCount ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-mira-blue">Nurse Mira · Admin</p>
          <Greeting person={profile} className="text-2xl font-semibold" />
        </div>
        <SignOutButton />
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-mira-line">
            <p className="text-sm text-mira-muted">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </section>

      <p className="mt-6 rounded-xl bg-mira-blue-soft px-4 py-3 text-sm text-mira-blue-dark">
        You&apos;re signed in as the administrator. Student management, curriculum editing and the shared library are
        being built next.
      </p>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading your admin dashboard…" />}>
      <AdminHome />
    </Suspense>
  );
}
