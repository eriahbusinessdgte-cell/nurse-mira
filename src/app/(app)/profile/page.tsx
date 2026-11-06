import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/supabase/server";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const metadata = { title: "Profile · Nurse Mira" };

async function ProfilePage() {
  const { profile } = await requireProfile();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={profile.role === "admin" ? "My Profile" : "Profile"} description="Update your name and account details." />
      <ProfileForm profile={profile} />
      <PasswordForm />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading your profile…" />}>
      <ProfilePage />
    </Suspense>
  );
}
