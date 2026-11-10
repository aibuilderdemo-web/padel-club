import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { bookableDays, getFreeSlots, type CourtSlots } from "@/lib/booking";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="font-heading text-4xl font-bold">Free courts</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading courts…</p>}>
        <DayView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DayView({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { day } = await searchParams;
  let days, user;
  try {
    [days, user] = await Promise.all([bookableDays(), currentUser()]);
  } catch (error) {
    return (
      <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
        Could not load the days: {(error as Error).message}
      </p>
    );
  }
  const selected = days.find((d) => d.date === day) ?? days[0];
  const result = await getFreeSlots(selected.date).then(
    (courts) => ({ courts, error: null }),
    (error: Error) => ({ courts: [] as CourtSlots[], error: error.message }),
  );

  return (
    <>
      <nav aria-label="Day" className="-mx-4 mt-4 overflow-x-auto px-4 pb-2">
        <ul className="flex gap-2">
          {days.map((d) => (
            <li key={d.date}>
              <Link
                href={`/?day=${d.date}`}
                aria-current={d.date === selected.date ? "date" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 ${
                  d.date === selected.date
                    ? "border-club bg-club text-white"
                    : "border-zinc-300 text-club"
                }`}
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!user && (
        <p className="mt-2 text-zinc-700">
          Members book up to 7 days ahead.{" "}
          <Link href="/login" className="text-club underline">
            Log in
          </Link>
        </p>
      )}
      {user && days.length <= 3 && (
        <p className="mt-2 text-zinc-700">
          <Link href="/my-bookings" className="text-club underline">
            Become a member
          </Link>{" "}
          to book up to 7 days ahead.
        </p>
      )}

      {result.error && (
        <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Could not load the courts: {result.error}
        </p>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {result.courts.map((court) => (
          <section key={court.id}>
            <div className="flex aspect-video items-center justify-center rounded bg-zinc-200">
              <h2 className="font-heading text-3xl font-bold text-zinc-700">{court.name}</h2>
            </div>
            {court.slots.length === 0 ? (
              <p className="mt-3 text-zinc-600">No free times this day.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Free times on ${court.name}`}>
                {court.slots.map((slot) => (
                  <li key={slot.startsAt}>
                    <Link
                      href={`/book?court=${court.id}&at=${encodeURIComponent(slot.startsAt)}`}
                      aria-label={`Book ${court.name} at ${slot.time}`}
                      className="flex min-h-11 items-center rounded border border-club px-3 font-medium tabular-nums text-club hover:bg-club hover:text-white"
                    >
                      {slot.time}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
