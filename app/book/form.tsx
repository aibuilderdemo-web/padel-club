"use client";

import { useActionState } from "react";

export type BookState = { error: string | null; name: string; phone: string };

export function BookForm({
  action,
  courtId,
  startsAt,
  name,
  phone,
}: {
  action: (state: BookState, form: FormData) => Promise<BookState>;
  courtId: number;
  startsAt: string;
  name: string; // prefilled from the profile when logged in
  phone: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, name, phone });

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="court" value={courtId} />
      <input type="hidden" name="at" value={startsAt} />

      <label className="flex flex-col gap-1">
        <span className="font-medium">Your name</span>
        <input
          name="name"
          required
          autoComplete="name"
          defaultValue={state.name}
          className="min-h-12 rounded border border-zinc-400 px-3 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Phone</span>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          defaultValue={state.phone}
          className="min-h-12 rounded border border-zinc-400 px-3 text-lg"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Could not book: {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded bg-club px-6 text-lg font-semibold text-white hover:bg-club-dark disabled:opacity-60"
      >
        {pending ? "Booking…" : "Book"}
      </button>
    </form>
  );
}
