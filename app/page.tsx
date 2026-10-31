import Link from "next/link";
import { Suspense } from "react";
import { createAuthClient } from "@/lib/supabase/auth";
import { isActiveMember } from "@/lib/membership";
import { createPublicClient } from "@/lib/supabase/server";
import { dayWindow, isValidDate, overlaps, slotsForDate, todayInMilan } from "@/lib/slots";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Padel Club Navigli</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading courts...</p>}>
        <Courts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Courts({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).date;
  const requested = typeof raw === "string" ? raw : undefined;
  const today = todayInMilan();
  const dateOk = requested === undefined || isValidDate(requested);
  const date = requested && dateOk ? requested : today;

  // Guests and non-members can book 2 days ahead, active members 7
  // (the database enforces it; this only limits the picker).
  const errors: string[] = [];
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  let member = false;
  if (auth.user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("membership_status")
      .eq("id", auth.user.id)
      .single();
    if (profileError) errors.push(`Profile: ${profileError.message}`);
    member = isActiveMember(profile?.membership_status);
  }
  const maxDate = new Date(`${today}T00:00:00Z`);
  maxDate.setUTCDate(maxDate.getUTCDate() + (member ? 7 : 2));

  if (!dateOk) errors.push(`"${requested}" is not a valid date. Showing today.`);

  const { data: courts, error: courtsError } = await createPublicClient()
    .from("courts")
    .select("id, name")
    .order("name");
  if (courtsError) errors.push(`Courts: ${courtsError.message}`);

  const { from, to } = dayWindow(date);
  const { data: bookings, error: bookingsError } = await createPublicClient().rpc("taken_slots", {
    from_ts: from,
    to_ts: to,
  });
  if (bookingsError) errors.push(`Bookings: ${bookingsError.message}`);

  const booked = ((bookings ?? []) as { court_id: number; starts_at: string }[]).map((b) => ({
    courtId: b.court_id,
    startsAt: new Date(b.starts_at),
  }));
  const slots = slotsForDate(date);

  return (
    <>
      <form className="mt-4 flex items-center gap-2">
        <label htmlFor="date">Date</label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={date}
          min={today}
          max={maxDate.toISOString().slice(0, 10)}
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded border px-3 py-1">
          Show
        </button>
      </form>

      {errors.map((e) => (
        <p key={e} role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {e}
        </p>
      ))}

      <p className="mt-4 text-sm text-zinc-600">Free slots on {date} (Milan time)</p>

      {(courts ?? []).map((court) => {
        const free = slots.filter(
          (s) => !booked.some((b) => b.courtId === court.id && overlaps(s.startsAt, b.startsAt)),
        );
        return (
          <section key={court.id} className="mt-6">
            <h2 className="text-lg font-medium">{court.name}</h2>
            {free.length === 0 ? (
              <p className="text-zinc-600">No free slots.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {free.map((s) => (
                  <li key={s.label}>
                    <Link
                      href={`/book?court=${court.id}&date=${date}&time=${s.label}`}
                      className="block rounded border px-2 py-1 text-sm hover:bg-zinc-100"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
