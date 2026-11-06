import { Suspense } from "react";
import { BookMarked, UserPlus, Users } from "lucide-react";
import { Greeting } from "@/components/greeting";
import { PageLoading } from "@/components/page-loading";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { requireProfile } from "@/lib/supabase/server";

export const metadata = { title: "Admin · Nurse Mira" };

const ACTION_TEXT: Record<string, string> = {
  "student.invited": "invited",
  "student.setup_link": "made a new setup or reset link for",
  "student.updated": "updated the details of",
  "student.subjects_updated": "changed the subjects of",
  "student.deactivated": "turned off the account of",
  "student.reactivated": "turned back on the account of",
  "student.deleted": "permanently deleted",
};

const CURRICULUM_TEXT: Record<string, string> = {
  "curriculum.subject_added": "added the subject",
  "curriculum.subject_updated": "updated the subject",
  "curriculum.subject_retired": "retired a subject",
  "curriculum.subject_restored": "restored a subject",
  "curriculum.topic_added": "added the topic",
  "curriculum.topic_renamed": "renamed a topic to",
  "curriculum.topic_retired": "retired a topic",
  "curriculum.topic_restored": "restored a topic",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function Overview() {
  const { supabase, profile } = await requireProfile("admin");

  const [active, inactive, notSetUp, subjects, activity] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("is_active", false),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("is_active", true)
      .eq("onboarding_completed", false),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("activity_log")
      .select("id, action, details, created_at, target:profiles!activity_log_target_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const stats = [
    { label: "Active students", value: active.count ?? 0 },
    { label: "Not set up yet", value: notSetUp.count ?? 0 },
    { label: "Turned off", value: inactive.count ?? 0 },
    { label: "Subjects", value: subjects.count ?? 0 },
  ];

  type Activity = { id: number; action: string; details: { email?: string; name?: string; title?: string; code?: string }; created_at: string; target: { full_name: string; email: string } | null };
  const items = (activity.data ?? []) as unknown as Activity[];

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-mira-blue">Administrator</p>
          <Greeting person={profile} className="text-2xl font-semibold" />
          <p className="mt-1 text-sm text-mira-muted">Here&apos;s what&apos;s happening in Nurse Mira.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/students?invite=1" kind="accent">
            <UserPlus size={18} aria-hidden /> Add student
          </ButtonLink>
          <ButtonLink href="/admin/students" kind="secondary">
            <Users size={18} aria-hidden /> Students
          </ButtonLink>
          <ButtonLink href="/admin/curriculum" kind="secondary">
            <BookMarked size={18} aria-hidden /> Curriculum
          </ButtonLink>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-mira-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Recent activity</h2>
        {items.length === 0 ? (
          <EmptyState title="Nothing yet">Invitations and changes you make will be listed here.</EmptyState>
        ) : (
          <ul className="divide-y divide-mira-line text-sm">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                {a.action.startsWith("curriculum.") ? (
                  <span>
                    You {CURRICULUM_TEXT[a.action] ?? a.action}{" "}
                    <span className="font-medium">{a.details?.name || a.details?.code || a.details?.title || ""}</span>
                  </span>
                ) : (
                  <span>
                    You {ACTION_TEXT[a.action] ?? a.action}{" "}
                    <span className="font-medium">{a.target?.full_name || a.target?.email || a.details?.email || "a student"}</span>
                  </span>
                )}
                <span className="text-mira-muted">{when(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading your admin dashboard…" />}>
      <Overview />
    </Suspense>
  );
}
