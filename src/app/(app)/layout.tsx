import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { ADMIN_NAV, SEM_LABEL, STUDENT_NAV, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";
import { firstName } from "@/lib/greeting";

// One frame for every signed-in page: sidebar, search bar, sign out.
// Each page still checks the person's role itself.
async function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const isAdmin = profile.role === "admin";
  const name = firstName(profile.full_name, profile.preferred_name) || profile.email;

  const year = profile.year_level ?? 0;
  const sem = profile.current_semester ?? 0;
  const step = year && sem ? (year - 1) * 2 + sem : 0;

  const footer = !isAdmin && step ? (
    <div className="rounded-xl bg-mira-blue-dark/60 p-3 text-sm">
      <p className="text-white/80">
        {YEAR_LABEL[year]} · {SEM_LABEL[sem]}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className="h-full rounded-full bg-mira-yellow" style={{ width: `${(step / 8) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-white/60">Semester {step} of 8</p>
    </div>
  ) : undefined;

  return (
    <AppShell
      nav={isAdmin ? ADMIN_NAV : STUDENT_NAV}
      homeHref={isAdmin ? "/admin" : "/dashboard"}
      areaLabel={isAdmin ? "Administrator" : "Study companion"}
      personName={name}
      footer={footer}
      searchPlaceholder={isAdmin ? "Search students or subjects…" : "What do you want to learn today?"}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoading label="Opening Nurse Mira…" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
