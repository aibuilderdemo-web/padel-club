"use client";

import { useActionState } from "react";
import { bookSlot, type BookState } from "./actions";

export function BookingForm({
  courtId,
  date,
  time,
  defaultName = "",
  defaultPhone = "",
}: {
  courtId: string;
  date: string;
  time: string;
  defaultName?: string;
  defaultPhone?: string;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookSlot, {
    error: null,
  });

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="court" value={courtId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      {state.error && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      )}

      <label className="block">
        Name
        <input name="name" required defaultValue={defaultName} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>
      <label className="block">
        Phone
        <input
          name="phone"
          defaultValue={defaultPhone}
          type="tel"
          required
          placeholder="+39 333 1234567"
          className="mt-1 block w-full rounded border px-2 py-1"
        />
      </label>
      <button type="submit" disabled={pending} className="rounded border px-3 py-1">
        {pending ? "Booking..." : "Book"}
      </button>
    </form>
  );
}
