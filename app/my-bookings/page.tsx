import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { cancelBooking, myBookings, slotTime, type MyBooking } from "@/lib/booking";
import { CancelButton } from "./cancel";

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
      {user.profile && <p className="mt-2 text-lg">Hello, {user.profile.fullName}.</p>}

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
