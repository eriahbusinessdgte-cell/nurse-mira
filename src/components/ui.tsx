// Shared building blocks so every page looks the same.
import Link from "next/link";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-mira-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-mira-line ${className}`}>{children}</section>;
}

export function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-mira-line bg-mira-page/60 px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      <div className="mx-auto mt-1 max-w-md text-sm text-mira-muted">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const BUTTON = {
  primary: "bg-mira-blue text-white hover:bg-mira-blue-dark",
  accent: "bg-mira-yellow text-mira-blue-dark hover:bg-mira-yellow-dark",
  secondary: "bg-white text-mira-ink ring-1 ring-mira-line hover:bg-mira-blue-soft",
  danger: "bg-white text-mira-danger ring-1 ring-red-200 hover:bg-red-50",
};
export type ButtonKind = keyof typeof BUTTON;

export const buttonClass = (kind: ButtonKind = "primary", extra = "") =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON[kind]} ${extra}`;

export function ButtonLink({ href, kind = "primary", children }: { href: string; kind?: ButtonKind; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(kind)}>
      {children}
    </Link>
  );
}

export const inputClass =
  "mt-1 w-full rounded-lg border border-mira-line bg-white px-3 py-2.5 text-sm text-mira-ink outline-none focus:border-mira-blue focus:ring-2 focus:ring-mira-blue/20";

export function Badge({ tone = "blue", children }: { tone?: "blue" | "green" | "gray" | "yellow" | "red"; children: React.ReactNode }) {
  const tones = {
    blue: "bg-mira-blue-soft text-mira-blue-dark",
    green: "bg-green-50 text-mira-success",
    gray: "bg-gray-100 text-mira-muted",
    yellow: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-mira-danger",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
