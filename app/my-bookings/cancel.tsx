"use client";

import { useActionState } from "react";

// One Cancel button for one booking. Shows the database's error under it.
export function CancelButton({
  action,
  id,
}: {
  action: (error: string | null, form: FormData) => Promise<string | null>;
  id: string;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded border border-club px-4 font-medium text-club hover:bg-club hover:text-white disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Could not cancel: {error}
        </p>
      )}
    </form>
  );
}
