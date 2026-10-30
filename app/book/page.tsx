import Link from "next/link";
import { Suspense } from "react";
import { parseSlot } from "@/lib/slots";
import { createPublicClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function BookPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Book a court</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Details searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Details({ searchParams }: { searchParams: SearchParams }) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
  const courtId = one("court");
  const date = one("date");
  const time = one("time");

  const back = (
    <Link href={date ? `/?date=${encodeURIComponent(date)}` : "/"} className="underline">
      Back to free slots
    </Link>
  );

  if (!parseSlot(date, time)) {
    return (
      <div className="mt-4 space-y-3">
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          That slot is not available to book (past, outside opening hours, or not on the hour or half hour).
        </p>
        {back}
      </div>
    );
  }

  const { data: court, error } = await createPublicClient()
    .from("courts")
    .select("id, name")
    .eq("id", courtId)
    .maybeSingle();

  if (error || !court) {
    return (
      <div className="mt-4 space-y-3">
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {error ? `Court: ${error.message}` : "Court not found."}
        </p>
        {back}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p>
        {court.name}, {date}, {time} (Milan time, 90 minutes)
      </p>
      <BookingForm courtId={String(court.id)} date={date} time={time} />
      <p className="mt-4">{back}</p>
    </div>
  );
}
