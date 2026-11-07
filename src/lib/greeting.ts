/** "Good morning" (5:00–11:59), "Good afternoon" (12:00–17:59), "Good evening" otherwise. */
export function timeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The name to greet someone by, without a "Nurse" they may have added themselves.
 * A preferred name is used exactly as typed ("Ana Marie"); otherwise the first word of the full name.
 */
export function firstName(fullName: string, preferredName?: string | null): string {
  const strip = (s: string) => s.trim().replace(/^nurse\.?\s+/i, "").replace(/\s+/g, " ");
  const preferred = strip(preferredName ?? "");
  if (preferred) return preferred.slice(0, 40);
  return strip(fullName).split(" ")[0] ?? "";
}

/** Students: "Good morning, Nurse Ana". Admin: "Good morning, Erika". */
export function greetingFor(
  person: { full_name: string; preferred_name?: string | null; role: "student" | "admin" },
  date: Date = new Date(),
): string {
  const name = firstName(person.full_name, person.preferred_name);
  const base = timeOfDayGreeting(date);
  if (!name) return person.role === "student" ? `${base}, Nurse` : base;
  return person.role === "student" ? `${base}, Nurse ${name}` : `${base}, ${name}`;
}
