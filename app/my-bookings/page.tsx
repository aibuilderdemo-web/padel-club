import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { cancelBooking, myBookings, slotTime, type MyBooking } from "@/lib/booking";
import { startCheckout } from "@/lib/membership";
import { BecomeMember, CancelButton } from "./cancel";

// Logged-in users only, checked here on the server. Sends them to Stripe
// Checkout, or returns Stripe's error for the page.
async function becomeMemberAction(): Promise<string | null> {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/login?next=/my-bookings");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  let url: string;
  try {
    url = await startCheckout(user, origin);
  } catch (error) {
    return (error as Error).message;
  }
  redirect(url);
}

async function cancelAction(_: string | null, form: FormData): Promise<string | null> {
  "use server";
  try {
    await cancelBooking(String(form.get("id") ?? ""));
  } catch (error) {
    return (error as Error).message;
  }
  revalidatePath("/my-bookings");
  return null;
}

export default function MyBookingsPage() {
  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">My bookings</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading…</p>}>
        <MyBookingsView />
      </Suspense>
    </div>
  );
}

async function MyBookingsView() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/my-bookings");

  const result = await myBookings().then(
    (bookings) => ({ ...bookings, error: null }),
    (error: Error) => ({ upcoming: [], past: [], error: error.message }),
  );

  return (
    <>
      {user.profile && (
        <p className="mt-2 text-lg">
          Hello, {user.profile.fullName}.{" "}
          <Link href="/profile" className="text-club underline">
            Edit name and phone
          </Link>
        </p>
      )}

      {user.profile?.paidMember ? (
        <p className="mt-6 rounded border border-club p-4 text-lg font-semibold text-club">
          You are a member of the club.
        </p>
      ) : (
        <BecomeMember action={becomeMemberAction} />
      )}

      {result.error && (
        <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Could not load your bookings: {result.error}
        </p>
      )}

      <h2 className="mt-8 font-heading text-2xl font-bold">Coming up</h2>
      {result.upcoming.length === 0 ? (
        <p className="mt-2 text-zinc-600">
          No bookings coming up.{" "}
          <Link href="/" className="text-club underline">
            Find a free court
          </Link>
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {result.upcoming.map((booking) => (
            <li key={booking.id} className="rounded border border-zinc-300 p-4">
              <BookingLine booking={booking} />
              <p className="mt-1 text-zinc-700">
                Cancel code <span className="font-mono font-bold tracking-widest">{booking.cancelCode}</span>
              </p>
              <CancelButton action={cancelAction} id={booking.id} />
            </li>
          ))}
        </ul>
      )}

      {result.past.length > 0 && (
        <>
          <h2 className="mt-8 font-heading text-2xl font-bold">Played</h2>
          <ul className="mt-3 flex flex-col gap-2 text-zinc-700">
            {result.past.map((booking) => (
              <li key={booking.id}>
                <BookingLine booking={booking} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function BookingLine({ booking }: { booking: MyBooking }) {
  const slot = slotTime(booking.startsAt);
  return (
    <p className="text-lg">
      <span className="font-semibold">{booking.courtName}</span>, {slot.day}, {slot.time} to {slot.endTime}
    </p>
  );
}
