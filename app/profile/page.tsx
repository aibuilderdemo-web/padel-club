import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAuthClient } from "@/lib/supabase/auth";
import { ProfileForm } from "./profile-form";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">My profile</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Details />
      </Suspense>
    </main>
  );
}

async function Details() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !profile) {
    return (
      <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
        {error ? `Profile: ${error.message}` : "No profile found for your account."}
      </p>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-zinc-600">{auth.user.email}</p>
      <ProfileForm fullName={profile.full_name} phone={profile.phone} />
    </>
  );
}
