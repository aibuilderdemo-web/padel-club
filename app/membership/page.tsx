import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAuthClient } from "@/lib/supabase/auth";
import { isActiveMember } from "@/lib/membership";
import { CheckoutButton } from "./checkout-button";
import { ManageButton } from "./manage-button";

export default function MembershipPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Membership</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("membership_status, stripe_customer_id")
    .eq("id", auth.user.id)
    .single();
  if (error) {
    return (
      <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
        Profile: {error.message}
      </p>
    );
  }
  if (isActiveMember(profile.membership_status)) {
    return (
      <>
        <p className="mt-4">Your membership is active. You can book up to 7 days ahead.</p>
        <ManageButton />
      </>
    );
  }
  return (
    <>
      {profile.membership_status && (
        <p className="mt-4 text-zinc-600">Membership status: {profile.membership_status}</p>
      )}
      {profile.stripe_customer_id && <ManageButton />}
      <CheckoutButton />
    </>
  );
}
