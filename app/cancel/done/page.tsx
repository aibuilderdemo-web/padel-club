import Link from "next/link";

export default function CancelDonePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Booking cancelled</h1>
      <p className="mt-4">The slot is free again.</p>
      <p className="mt-4"><Link href="/" className="underline">Back to free slots</Link></p>
    </main>
  );
}
