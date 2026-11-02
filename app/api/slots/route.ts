import { NextResponse } from "next/server";
import { dayWindow, isValidDate, overlaps, slotsForDate } from "@/lib/slots";
import { createPublicClient } from "@/lib/supabase/server";

// Free slots on one day, for the slot list on /book. Each slot has the instant (start, ISO)
// and a label for people, in Italian.
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!isValidDate(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const supabase = createPublicClient();
  const { data: courts, error: courtsError } = await supabase.from("courts").select("id, name").order("name");
  if (courtsError) return NextResponse.json({ error: courtsError.message }, { status: 500 });

  const { from, to } = dayWindow(date);
  const { data: bookings, error: bookingsError } = await supabase.rpc("taken_slots", { from_ts: from, to_ts: to });
  if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 });

  const booked = ((bookings ?? []) as { court_id: number; starts_at: string }[]).map((b) => ({
    courtId: b.court_id,
    startsAt: new Date(b.starts_at),
  }));
  const label = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Rome" });

  const slots = (courts ?? []).flatMap((court) =>
    slotsForDate(date)
      .filter((s) => !booked.some((b) => b.courtId === court.id && overlaps(s.startsAt, b.startsAt)))
      .map((s) => ({
        courtId: court.id,
        court: court.name,
        time: s.label,
        start: s.startsAt.toISOString(),
        label: label.format(s.startsAt),
      })),
  );
  return NextResponse.json({ date, slots });
}
