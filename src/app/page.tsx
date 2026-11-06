import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";

// Front door: sends each signed-in person to the right home.
async function Home(): Promise<React.ReactNode> {
  const { profile } = await requireProfile();
  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Opening Nurse Mira…" />}>
      <Home />
    </Suspense>
  );
}
