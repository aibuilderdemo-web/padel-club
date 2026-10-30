const TZ = "Europe/Rome";
const FIRST_START_MINUTES = 8 * 60;
const LAST_START_MINUTES = 21 * 60 + 30; // 90 minutes must end by 23:00
const STEP_MINUTES = 30;

export type Slot = { startsAt: Date; label: string };

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function milanParts(d: Date) {
  const p = Object.fromEntries(
    partsFormat.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    ms: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second),
  };
}

export function todayInMilan(now = new Date()): string {
  return milanParts(now).date;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Milan wall-clock time on a date -> the real instant.
function milanToInstant(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = new Date(wall);
  // The offset depends on the instant itself, so settle in two passes.
  for (let i = 0; i < 2; i++) {
    guess = new Date(wall - (milanParts(guess).ms - guess.getTime()));
  }
  return guess;
}

export function slotsForDate(date: string, now = new Date()): Slot[] {
  const slots: Slot[] = [];
  for (let m = FIRST_START_MINUTES; m <= LAST_START_MINUTES; m += STEP_MINUTES) {
    const startsAt = milanToInstant(date, m);
    if (startsAt.getTime() <= now.getTime()) continue;
    const label = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    slots.push({ startsAt, label });
  }
  return slots;
}

export const BOOKING_MINUTES = 90;

// Search window for bookings that could touch this Milan day: a booking that
// starts up to 90 minutes before or after the day still blocks its edge slots.
export function dayWindow(date: string): { from: string; to: string } {
  const pad = (BOOKING_MINUTES - 1) * 60_000;
  return {
    from: new Date(milanToInstant(date, 0).getTime() - pad).toISOString(),
    to: new Date(milanToInstant(date, 24 * 60).getTime() + pad).toISOString(),
  };
}

// True if a 90-minute booking starting at `slot` would overlap one starting at `booked`.
export function overlaps(slot: Date, booked: Date): boolean {
  return Math.abs(slot.getTime() - booked.getTime()) < BOOKING_MINUTES * 60_000;
}

// A real, still-bookable slot for this date and "HH:MM" label, or null.
export function parseSlot(date: string, time: string, now = new Date()): Date | null {
  if (!isValidDate(date)) return null;
  return slotsForDate(date, now).find((s) => s.label === time)?.startsAt ?? null;
}

export function formatMilan(d: Date): { date: string; time: string } {
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(d);
  return {
    date: f({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}
