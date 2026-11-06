import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/** Supabase client for server components, route handlers and server actions. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  preferred_name: string | null;
  role: "student" | "admin";
  year_level: number | null;
  current_semester: number | null;
  is_active: boolean;
  onboarding_completed: boolean;
};

/**
 * Returns the signed-in person's profile, or sends them to the login page.
 * Deactivated accounts are signed out. Optionally requires a role.
 */
export async function requireProfile(role?: Profile["role"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, preferred_name, role, year_level, current_semester, is_active, onboarding_completed")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?notice=inactive");
  }
  if (role && profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return { supabase, profile };
}

/** For student pages: also sends students who haven't finished onboarding to /welcome. */
export async function requireStudent() {
  const result = await requireProfile("student");
  if (!result.profile.onboarding_completed) redirect("/welcome");
  return result;
}
