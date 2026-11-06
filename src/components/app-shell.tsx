"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileHeart,
  GraduationCap,
  HardDrive,
  DatabaseBackup,
  Activity,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Menu,
  MessageCircleHeart,
  Search,
  Settings,
  Stethoscope,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  BookOpen,
  MessageCircleHeart,
  GraduationCap,
  FileHeart,
  ClipboardList,
  ListChecks,
  CalendarDays,
  Library,
  UserRound,
  Users,
  BookMarked,
  HardDrive,
  DatabaseBackup,
  Activity,
  Settings,
};

type Props = {
  nav: NavItem[];
  homeHref: string;
  areaLabel: string;
  personName: string;
  footer?: React.ReactNode;
  searchPlaceholder: string;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string, homeHref: string) {
  if (href === homeHref) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({ nav, homeHref, areaLabel, footer, onNavigate }: Omit<Props, "children" | "personName" | "searchPlaceholder"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-mira-blue px-4 py-6 text-white">
      <Link href={homeHref} onClick={onNavigate} className="mb-8 flex items-center overflow-hidden rounded-xl bg-mira-blue-dark">
        <span className="flex h-11 w-11 items-center justify-center bg-mira-yellow text-mira-blue-dark">
          <Stethoscope size={22} aria-hidden />
        </span>
        <span className="px-3 leading-tight">
          <span className="block font-semibold">Nurse Mira</span>
          <span className="block text-xs text-white/70">{areaLabel}</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          if (item.soon) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                title="Coming in a later update"
                className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50"
              >
                <Icon size={18} aria-hidden />
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
              </span>
            );
          }
          const active = isActive(pathname, item.href, homeHref);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active ? "bg-white font-medium text-mira-blue" : "text-white/90 hover:bg-white/10"
              }`}
            >
              <Icon size={18} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {footer && <div className="mt-6">{footer}</div>}
    </div>
  );
}

export function AppShell(props: Props) {
  const [open, setOpen] = useState(false);
  const initial = props.personName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">
        <Sidebar {...props} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 max-w-[85%]">
            <Sidebar {...props} onNavigate={() => setOpen(false)} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-mira-line bg-mira-page/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-mira-ink hover:bg-white lg:hidden"
          >
            <Menu size={22} />
          </button>

          <form action="/search" method="get" role="search" className="relative max-w-md flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mira-muted" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder={props.searchPlaceholder}
              aria-label="Search"
              className="w-full rounded-xl border border-mira-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-mira-blue focus:ring-2 focus:ring-mira-blue/20"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-mira-yellow font-semibold text-mira-blue-dark"
              title={props.personName}
              aria-hidden
            >
              {initial}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-mira-muted hover:bg-white hover:text-mira-ink"
              >
                <LogOut size={16} aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{props.children}</main>
      </div>
    </div>
  );
}
