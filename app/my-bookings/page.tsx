import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatMilan } from "@/lib/slots";
import { createAuthClient } from "@/lib/supabase/auth";
import { CancelButton } from "./cancel-button";

export default function MyBookingsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">My bookings</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <List />
      </Suspense>
    </main>
  );
}

const isFuture = (d: Date) => d.getTime() > Date.now();

async function List() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // RLS returns only this user's rows; the filter just makes the intent visible.
  const { data, error } = await supabase
    .from("bookings")
    .select("id, starts_at, cancelled_at, courts(name)")
    .eq("user_id", auth.user.id)
    .order("starts_at", { ascending: false });

  if (error) {
    return (
      <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
        Bookings: {error.message}
      </p>
    );
  }
  if (data.length === 0) return <p className="mt-4">You have no bookings yet.</p>;

  return (
    <table className="mt-4 w-full text-left">
      <thead>
        <tr className="border-b">
          <th className="py-1">Date</th>
          <th>Time</th>
          <th>Court</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((b) => {
          const court = Array.isArray(b.courts) ? b.courts[0] : b.courts;
          const start = new Date(b.starts_at);
          const f = formatMilan(start);
          return (
            <tr key={b.id} className="border-b">
              <td className="py-1">{f.date}</td>
              <td>{f.time}</td>
              <td>{court?.name}</td>
              <td>
                {b.cancelled_at ? (
                  <span className="text-zinc-600">Cancelled</span>
                ) : isFuture(start) ? (
                  <CancelButton id={b.id} />
                ) : (
                  <span className="text-zinc-600">Past</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
