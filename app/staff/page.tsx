import { connection } from "next/server";
import { Suspense } from "react";
import { formatMilan, milanDayBounds, todayInMilan } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";

// Temporary: no login yet (day 17), so anyone with this URL sees guest phones.
// Not linked from any guest screen.
export default function StaffPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Today&apos;s bookings</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Bookings />
      </Suspense>
    </main>
  );
}

async function Bookings() {
  // Render at request time: "today" must not be frozen at build time.
  await connection();
  const today = todayInMilan();
  const { from, to } = milanDayBounds(today);

  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("starts_at, guest_name, phone, courts(name)")
    .is("cancelled_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at")
    .order("court_id");

  if (error) {
    return (
      <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
        Bookings: {error.message}
      </p>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-zinc-600">{today} (Milan time)</p>
      {data.length === 0 ? (
        <p className="mt-4">No bookings today.</p>
      ) : (
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-1">Time</th>
              <th>Court</th>
              <th>Name</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => {
              const court = Array.isArray(b.courts) ? b.courts[0] : b.courts;
              return (
                <tr key={i} className="border-b">
                  <td className="py-1">{formatMilan(new Date(b.starts_at)).time}</td>
                  <td>{court?.name}</td>
                  <td>{b.guest_name}</td>
                  <td>{b.phone}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
