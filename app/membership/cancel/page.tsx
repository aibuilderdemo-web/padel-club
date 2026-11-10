import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";

// Where Stripe sends a user who goes back without paying.
// Logged-in users only, checked on the server.
export default function MembershipCancelPage() {
  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">No payment made</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading…</p>}>
        <CancelView />
      </Suspense>
    </div>
  );
}

async function CancelView() {
  if (!(await currentUser())) redirect("/login?next=/my-bookings");
  return (
    <>
      <p className="mt-4 text-lg">You left Stripe before paying. Nothing was charged.</p>
      <Link href="/my-bookings" className="mt-6 inline-block text-club underline">
        ← Back to My bookings to try again
      </Link>
    </>
  );
}
