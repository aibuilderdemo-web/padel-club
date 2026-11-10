// Everything the pages need about courts and bookings.
// Hides Supabase and Milan time. Supabase errors are thrown with their message.

import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

const TIME_ZONE = "Europe/Rome";
const BOOKABLE_DAYS = 14;

export type Day = { date: string; label: string };
export type Slot = { startsAt: string; time: string };
export type CourtSlots = { id: number; name: string; slots: Slot[] };

// Publishable key only: the public can read courts and call free_slots.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

// Today plus the next 13 days, Milan time. Dates are YYYY-MM-DD.
export async function bookableDays(): Promise<Day[]> {
  await connection(); // "today" is read per request, never prerendered
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const noon = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: BOOKABLE_DAYS }, (_, i) => {
    const day = new Date(noon.getTime() + i * 24 * 60 * 60 * 1000);
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : day.toLocaleDateString("en-GB", {
              timeZone: "UTC",
              weekday: "short",
              day: "numeric",
              month: "short",
            });
    return { date: day.toISOString().slice(0, 10), label };
  });
}

// The courts with their free start times on a day, in court order.
export async function getFreeSlots(date: string): Promise<CourtSlots[]> {
  const [courts, free] = await Promise.all([
    supabase.from("courts").select("id, name").order("id"),
    supabase.rpc("free_slots", { for_day: date }),
  ]);
  if (courts.error) throw new Error(courts.error.message);
  if (free.error) throw new Error(free.error.message);

  const rows = free.data as { court_id: number; starts_at: string }[];
  return (courts.data as { id: number; name: string }[]).map((court) => ({
    ...court,
    slots: rows
      .filter((row) => row.court_id === court.id)
      .map((row) => ({ startsAt: row.starts_at, time: slotTime(row.starts_at).time })),
  }));
}

// One court by id, or null if there is none.
export async function getCourt(id: number): Promise<{ id: number; name: string } | null> {
  const { data, error } = await supabase.from("courts").select("id, name").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Books a slot through the database's book() function. Returns the booking id.
export async function book(input: {
  courtId: number;
  startsAt: string;
  name: string;
  phone: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("book", {
    p_court_id: input.courtId,
    p_starts_at: input.startsAt,
    p_guest_name: input.name,
    p_phone: input.phone,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export type Confirmation = { courtName: string; startsAt: string; cancelCode: string };

// Court, start and cancel code for a booking id, or null if there is none.
export async function getConfirmation(id: string): Promise<Confirmation | null> {
  const { data, error } = await supabase.rpc("confirmation", { p_id: id });
  if (error) throw new Error(error.message);
  const row = (data as { court_name: string; starts_at: string; cancel_code: string }[])[0];
  return row ? { courtName: row.court_name, startsAt: row.starts_at, cancelCode: row.cancel_code } : null;
}

// How a start time reads in Milan: its date (YYYY-MM-DD), day, start and end.
export function slotTime(startsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const time = (d: Date) =>
    d.toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    date: start.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }),
    day: start.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }),
    time: time(start),
    endTime: time(end),
  };
}
