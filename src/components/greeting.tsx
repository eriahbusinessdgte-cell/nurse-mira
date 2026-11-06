"use client";

import { useSyncExternalStore } from "react";
import { greetingFor } from "@/lib/greeting";

type Props = {
  person: { full_name: string; preferred_name?: string | null; role: "student" | "admin" };
  className?: string;
};

// The greeting uses the time on the viewer's own device, so it is worked out in
// the browser. The server renders a neutral "Welcome" first.
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};

export function Greeting({ person, className }: Props) {
  const text = useSyncExternalStore(
    subscribe,
    () => greetingFor(person),
    () => (person.role === "student" ? "Welcome, Nurse" : "Welcome"),
  );
  return <h1 className={className}>{text}</h1>;
}
