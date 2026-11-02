import Link from "next/link";
import { Suspense } from "react";
import { parseSlot } from "@/lib/slots";
import { createAuthClient } from "@/lib/supabase/auth";
import { createPublicClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";
import { SlotList } from "./SlotList";

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

  // No slot chosen yet: pick one from today's or tomorrow's free slots.
  if (!courtId && !date && !time) return <SlotList />;

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

  // Logged in: prefill from the profile (read through RLS as the user).
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("full_name, phone").eq("id", auth.user.id).maybeSingle()
    : { data: null };

  return (
    <div className="mt-4">
      <p>
        {court.name}, {date}, {time} (Milan time, 90 minutes)
      </p>
      <BookingForm courtId={String(court.id)} date={date} time={time}
        defaultName={profile?.full_name}
        defaultPhone={profile?.phone}
      />
      <p className="mt-4">{back}</p>
    </div>
  );
}
