// My Planner helpers (pure, unit-tested). Dates are plain "YYYY-MM-DD" strings in Philippine time.

export type Kind = "assignment" | "project" | "case_study" | "exam" | "clinical" | "study" | "reminder" | "other";
export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";
export type Item = {
  id: string;
  title: string;
  kind: Kind;
  subject_id: string | null;
  case_study_id: string | null;
  due_date: string | null;
  due_time: string | null;
  status: Status;
  priority: Priority;
  notes: string | null;
  completed_at: string | null;
};

export const KIND_LABEL: Record<Kind, string> = {
  assignment: "Assignment",
  project: "Project",
  case_study: "Case study",
  exam: "Exam",
  clinical: "Clinical requirement",
  study: "Study session",
  reminder: "Reminder",
  other: "Other",
};
export const KIND_COLOR: Record<Kind, string> = {
  assignment: "bg-blue-100 text-blue-800",
  project: "bg-violet-100 text-violet-800",
  case_study: "bg-rose-100 text-rose-800",
  exam: "bg-red-100 text-red-800",
  clinical: "bg-emerald-100 text-emerald-800",
  study: "bg-amber-100 text-amber-900",
  reminder: "bg-gray-100 text-gray-700",
  other: "bg-gray-100 text-gray-700",
};
export const STATUS_LABEL: Record<Status, string> = { todo: "To do", in_progress: "In progress", done: "Done" };
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type Bucket = "overdue" | "today" | "week" | "later" | "nodate" | "done";
export function bucket(item: Pick<Item, "status" | "due_date">, today: string): Bucket {
  if (item.status === "done") return "done";
  if (!item.due_date) return "nodate";
  if (item.due_date < today) return "overdue";
  if (item.due_date === today) return "today";
  if (item.due_date <= addDays(today, 7)) return "week";
  return "later";
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export function sortItems(a: Item, b: Item) {
  return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (a.due_time ?? "99").localeCompare(b.due_time ?? "99") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

/** Weeks (Sunday first) covering a month: each day is "YYYY-MM-DD"; days outside the month are included to fill the weeks. */
export function monthGrid(year: number, month: number /* 1-12 */): string[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const startDow = new Date(`${first}T00:00:00Z`).getUTCDay();
  let day = addDays(first, -startDow);
  const weeks: string[][] = [];
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  } while (Number(day.slice(5, 7)) === month || weeks.length < 4);
  return weeks;
}

export const formatTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
