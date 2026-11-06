import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { PageLoading } from "@/components/page-loading";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";
import { InviteStudent } from "./invite-student";

export const metadata = { title: "Students · Nurse Mira" };

type Row = {
  id: string;
  email: string;
  full_name: string;
  year_level: number | null;
  current_semester: number | null;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  student_subjects: { subject_id: string }[];
};

async function StudentList({ searchParams }: PageProps<"/admin/students">) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "all";

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, year_level, current_semester, is_active, onboarding_completed, created_at, student_subjects(subject_id)")
    .eq("role", "student")
    .order("full_name");
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  const { data, error } = await query.returns<Row[]>();

  const filters = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Turned off" },
  ];

  return (
    <>
      <PageHeader
        title="Students"
        description="Invite students, update their year and subjects, and manage their access."
        action={<InviteStudent defaultOpen={params.invite === "1"} />}
      />

      <Card>
        <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
            aria-label="Search students"
            className="w-full max-w-xs rounded-lg border border-mira-line px-3 py-2 text-sm outline-none focus:border-mira-blue"
          />
          <div className="flex gap-1" role="group" aria-label="Filter by status">
            {filters.map((f) => (
              <Link
                key={f.key}
                href={{ pathname: "/admin/students", query: { ...(q ? { q } : {}), status: f.key } }}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  status === f.key ? "bg-mira-blue text-white" : "bg-mira-page text-mira-muted hover:text-mira-ink"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </form>

        {error && <p className="text-sm text-mira-danger">Couldn&apos;t load students. Please refresh the page.</p>}

        {!error && data && data.length === 0 && (
          <EmptyState title={q || status !== "all" ? "No students match" : "No students yet"}>
            {q || status !== "all"
              ? "Try a different name or filter."
              : "Click Invite student to add your first student. You'll get a setup link to send them."}
          </EmptyState>
        )}

        {!error && data && data.length > 0 && (
          <ul className="divide-y divide-mira-line">
            {data.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/students/${s.id}`} className="flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-mira-page">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mira-blue-soft font-semibold text-mira-blue">
                    {(s.full_name || s.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.full_name || "(no name yet)"}</span>
                    <span className="block truncate text-sm text-mira-muted">{s.email}</span>
                  </span>
                  <span className="hidden text-right text-sm text-mira-muted md:block">
                    {s.year_level ? `${YEAR_LABEL[s.year_level]}` : "Year not set"}
                    {s.current_semester ? ` · ${SEM_LABEL[s.current_semester]}` : ""}
                    <span className="block">{s.student_subjects.length} subject(s)</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {s.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Turned off</Badge>}
                    {!s.onboarding_completed && s.is_active && <Badge tone="yellow">Not set up yet</Badge>}
                  </span>
                  <ChevronRight size={18} className="text-mira-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function Page(props: PageProps<"/admin/students">) {
  return (
    <Suspense fallback={<PageLoading label="Loading students…" />}>
      <StudentList {...props} />
    </Suspense>
  );
}
