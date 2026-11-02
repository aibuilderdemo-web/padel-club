"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

type ApiSlot = { courtId: number; court: string; time: string; start: string; label: string };

const slotFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const formatSlot = (value: string) => slotFormat.format(new Date(value));

function milanDate(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
}

const PHONE = "(max-width: 639px)";
const isPhone = () => window.matchMedia(PHONE).matches;
function subscribePhone(onChange: () => void) {
  const q = window.matchMedia(PHONE);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}

// Free slots for today or tomorrow. Phones get a compact list, laptops a list per court.
export function SlotList() {
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<ApiSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);

  function choose(day: string) {
    setDate(day);
    setSlots(null);
    setError(null);
    fetch(`/api/slots?date=${day}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setSlots(j.slots)))
      .catch((e) => setError(String(e)));
  }

  const days = [
    { name: "Today", date: milanDate(0) },
    { name: "Tomorrow", date: milanDate(1) },
  ];

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {days.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => choose(d.date)}
            className={`rounded border px-3 py-1 ${date === d.date ? "bg-black text-white" : ""}`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {date && !slots && !error && <p className="mt-4 text-zinc-600">Loading...</p>}
      {slots && slots.length === 0 && <p className="mt-4 text-zinc-600">No free slots.</p>}

      {slots && slots.length > 0 && phone && (
        <ul className="mt-4 divide-y">
          {slots.map((s) => (
            <li key={`${s.courtId}-${s.time}`}>
              <Link href={`/book?court=${s.courtId}&date=${date}&time=${s.time}`} className="block py-2">
                {formatSlot(s.label)} · {s.court}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {slots && slots.length > 0 && !phone && (
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <li key={`${s.courtId}-${s.time}`}>
              <Link
                href={`/book?court=${s.courtId}&date=${date}&time=${s.time}`}
                className="block rounded border px-2 py-1 text-sm hover:bg-zinc-100"
              >
                {s.court}, {formatSlot(s.start)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
