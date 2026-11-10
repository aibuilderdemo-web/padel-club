import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";

// Where Stripe sends a user after paying. Logged-in users only, checked on
// the server. It doesn't switch the membership on: that comes later, from
// Stripe itself, because anyone can open this address.
export default function MembershipSuccessPage() {
  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">Thank you</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading…</p>}>
        <SuccessView />
      </Suspense>
    </div>
  );
}

async function SuccessView() {
  if (!(await currentUser())) redirect("/login?next=/my-bookings");
  return (
    <>
      <p className="mt-4 text-lg">
        Your payment went through on Stripe. We will switch your membership on shortly.
      </p>
      <Link href="/my-bookings" className="mt-6 inline-block text-club underline">
        ← My bookings
      </Link>
    </>
  );
}
