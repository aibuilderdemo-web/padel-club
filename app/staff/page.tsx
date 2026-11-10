import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser, isStaff } from "@/lib/auth";
import { slotTime, todaysBookings } from "@/lib/booking";

// Staff and admins only. The check runs on the server before anything is
// read; everyone else, guests included, is sent to the home page. The query
// runs as the logged-in user, so RLS ("Staff read every booking") applies too.
export default function StaffPage() {
  return (
    <>
      <h1 className="font-heading text-4xl font-bold">Today&apos;s bookings</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading…</p>}>
        <StaffView />
      </Suspense>
    </>
  );
}

async function StaffView() {
  const user = await currentUser();
  if (!isStaff(user)) redirect("/");

  const result = await todaysBookings().then(
    (today) => ({ ...today, error: null }),
    (error: Error) => ({ date: "", day: "", bookings: [], error: error.message }),
  );

  if (result.error) {
    return (
      <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
        Could not load today&apos;s bookings: {result.error}
      </p>
    );
  }

  return (
    <>
      <p className="mt-2 text-lg">{result.day}, Milan time</p>
      {result.bookings.length === 0 ? (
        <p className="mt-6 text-zinc-600">No bookings today.</p>
      ) : (
        <div className="-mx-4 mt-6 overflow-x-auto px-4">
          <table className="w-full min-w-[32rem] text-left">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="py-2 pr-4 font-semibold">Court</th>
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 font-semibold">Phone</th>
              </tr>
            </thead>
            <tbody>
              {result.bookings.map((booking) => {
                const slot = slotTime(booking.startsAt);
                return (
                  <tr key={booking.id} className="border-b border-zinc-200">
                    <td className="py-3 pr-4">{booking.courtName}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {slot.time}–{slot.endTime}
                    </td>
                    <td className="py-3 pr-4">{booking.guestName}</td>
                    <td className="py-3">
                      <a href={`tel:${booking.phone}`} className="text-club underline">
                        {booking.phone}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
