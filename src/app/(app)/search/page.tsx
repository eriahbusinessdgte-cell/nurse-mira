import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Search · Nurse Mira" };

// One search box for everything. Students search subjects (study sessions and
// materials join later); the admin also finds students.
async function Results({ searchParams }: PageProps<"/search">) {
  const { supabase, profile } = await requireProfile();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const isAdmin = profile.role === "admin";

  if (!q) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState title="Type something to search">
          {isAdmin ? "Search for a student by name or email, or a subject by code or title." : "Search your subjects by code or title, like “NCM 106” or “pharmacology”."}
        </EmptyState>
      </>
    );
  }

  const safe = q.replace(/[%,()]/g, " ");
  const [subjects, mine, students] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, code, title, year_level, semester")
      .eq("is_active", true)
      .or(`code.ilike.%${safe}%,title.ilike.%${safe}%`)
      .order("sort_order")
      .limit(20),
    isAdmin ? Promise.resolve({ data: [] as { subject_id: string }[] }) : supabase.from("student_subjects").select("subject_id").eq("student_id", profile.id),
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, full_name, email, is_active")
          .eq("role", "student")
          .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
          .order("full_name")
          .limit(20)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string; is_active: boolean }[] }),
  ]);
  const mineSet = new Set((mine.data ?? []).map((r) => r.subject_id));
  const subjectRows = subjects.data ?? [];
  const studentRows = students.data ?? [];
  const nothing = subjectRows.length === 0 && studentRows.length === 0;

  return (
    <>
      <PageHeader title={`Results for “${q}”`} />
      {nothing && <EmptyState title="No results">Try a shorter word, a subject code like “NCM 109”, or check the spelling.</EmptyState>}

      <div className="space-y-6">
        {isAdmin && studentRows.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold">Students</h2>
            <ul className="divide-y divide-mira-line">
              {studentRows.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/students/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-mira-blue">
                    <span>
                      <span className="font-medium">{s.full_name || s.email}</span>
                      <span className="block text-sm text-mira-muted">{s.email}</span>
                    </span>
                    {!s.is_active && <Badge tone="gray">Turned off</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {subjectRows.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold">Subjects</h2>
            <ul className="divide-y divide-mira-line">
              {subjectRows.map((s) => (
                <li key={s.id}>
                  <Link
                    href={isAdmin ? `/admin/curriculum#${s.id}` : "/subjects"}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-mira-blue"
                  >
                    <span>
                      <span className="font-medium">{s.code}</span> — {s.title}
                      <span className="block text-sm text-mira-muted">
                        {YEAR_LABEL[s.year_level]} · {SEM_LABEL[s.semester]}
                      </span>
                    </span>
                    {mineSet.has(s.id) && <Badge>My subject</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<PageLoading label="Searching…" />}>
      <Results {...props} />
    </Suspense>
  );
}
