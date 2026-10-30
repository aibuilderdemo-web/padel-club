import Link from "next/link";
import { Suspense } from "react";
import { formatMilan } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <Suspense fallback={<p className="text-zinc-600">Loading...</p>}>
        <Booking params={params} />
      </Suspense>
    </main>
  );
}

async function Booking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("starts_at, guest_name, courts(name)")
    .eq("public_id", id)
    .maybeSingle();

  if (error) {
    return (
      <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
        Booking: {error.message}
      </p>
    );
  }
  if (!data) return <p>Booking not found.</p>;

  const court = Array.isArray(data.courts) ? data.courts[0] : data.courts;
  const when = formatMilan(new Date(data.starts_at));

  return (
    <>
      <h1 className="text-2xl font-semibold">Booking confirmed</h1>
      <dl className="mt-4 space-y-1">
        <div><dt className="inline font-medium">Court: </dt><dd className="inline">{court?.name}</dd></div>
        <div><dt className="inline font-medium">Date: </dt><dd className="inline">{when.date}</dd></div>
        <div><dt className="inline font-medium">Time: </dt><dd className="inline">{when.time} (Milan time, 90 minutes)</dd></div>
        <div><dt className="inline font-medium">Name: </dt><dd className="inline">{data.guest_name}</dd></div>
      </dl>
      <p className="mt-4"><Link href="/" className="underline">Back to free slots</Link></p>
    </>
  );
}
