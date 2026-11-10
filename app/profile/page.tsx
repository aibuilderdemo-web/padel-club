import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser, updateProfile } from "@/lib/auth";
import { ProfileForm, type AccountState } from "../login/forms";

// Logged-in users only, checked on the server in both the page and the
// action. RLS also limits the update to your own name and phone.
async function saveProfile(_: AccountState, form: FormData): Promise<AccountState> {
  "use server";
  const values = {
    full_name: String(form.get("full_name") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
  };
  if (!(await currentUser())) redirect("/login?next=/profile");
  if (!values.full_name) return { error: "Please enter your name.", done: null, values };
  if (!values.phone) return { error: "Please enter your phone number.", done: null, values };
  try {
    await updateProfile({ fullName: values.full_name, phone: values.phone });
  } catch (error) {
    return { error: (error as Error).message, done: null, values };
  }
  return { error: null, done: "Saved. New bookings will use these details.", values };
}

export default function ProfilePage() {
  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">Your profile</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading…</p>}>
        <ProfileView />
      </Suspense>
      <Link href="/my-bookings" className="mt-6 inline-block text-club underline">
        ← My bookings
      </Link>
    </div>
  );
}

async function ProfileView() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/profile");
  if (!user.profile) {
    return (
      <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
        Your profile was not found. Please contact the club.
      </p>
    );
  }
  return (
    <>
      <p className="mt-2 text-lg">{user.email}</p>
      <ProfileForm action={saveProfile} fullName={user.profile.fullName} phone={user.profile.phone} />
    </>
  );
}
