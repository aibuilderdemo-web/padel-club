import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getConfirmation, slotTime } from "@/lib/booking";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ConfirmationPage({ params }: PageProps<"/confirmation/[id]">) {
  return (
    <Suspense fallback={<p className="text-zinc-600">Loading…</p>}>
      <ConfirmationView params={params} />
    </Suspense>
  );
}

async function ConfirmationView({ params }: Pick<PageProps<"/confirmation/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const booking = await getConfirmation(id);
  if (!booking) notFound();
  const slot = slotTime(booking.startsAt);

  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">You&apos;re booked</h1>
      <p className="mt-2 text-lg">
        {booking.courtName}, {slot.day}, {slot.time} to {slot.endTime}
      </p>

      <div className="mt-6 rounded border border-zinc-300 bg-zinc-50 p-4">
        <p className="font-medium">Your cancel code</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{booking.cancelCode}</p>
        <p className="mt-2 text-zinc-700">Keep this code. You need it to cancel.</p>
      </div>

      <Link href="/" className="mt-6 inline-block text-club underline">
        Back to courts
      </Link>
    </div>
  );
}
