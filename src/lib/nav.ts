// Navigation for both areas. Items marked `soon` show in the menu with a
// "Soon" label so people can see what is coming, but are not clickable yet.
export type NavItem = { href: string; label: string; icon: string; soon?: boolean };

export const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/subjects", label: "My Subjects", icon: "BookOpen" },
  { href: "/tutor", label: "AI Tutor", icon: "MessageCircleHeart", soon: true },
  { href: "/review", label: "Review Center", icon: "GraduationCap", soon: true },
  { href: "/case-studies", label: "Case Studies", icon: "FileHeart", soon: true },
  { href: "/care-plans", label: "Nursing Care Plans", icon: "ClipboardList", soon: true },
  { href: "/quizzes", label: "Quizzes & Exams", icon: "ListChecks", soon: true },
  { href: "/planner", label: "My Planner", icon: "CalendarDays", soon: true },
  { href: "/library", label: "My Library", icon: "Library", soon: true },
  { href: "/profile", label: "Profile", icon: "UserRound" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "LayoutDashboard" },
  { href: "/admin/students", label: "Students", icon: "Users" },
  { href: "/admin/curriculum", label: "Curriculum", icon: "BookMarked" },
  { href: "/admin/library", label: "Shared Library", icon: "Library", soon: true },
  { href: "/admin/storage", label: "Storage", icon: "HardDrive", soon: true },
  { href: "/admin/settings", label: "Settings", icon: "Settings", soon: true },
  { href: "/profile", label: "My Profile", icon: "UserRound" },
];

export const YEAR_LABEL = ["", "First Year", "Second Year", "Third Year", "Fourth Year"];
export const SEM_LABEL = ["", "First Semester", "Second Semester"];
