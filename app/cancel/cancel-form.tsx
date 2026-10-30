"use client";

import { useActionState } from "react";
import { cancelBooking, type CancelState } from "./actions";

export function CancelForm({ initialCode }: { initialCode: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelBooking, { error: null });

  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block">
        <span className="block font-medium">Cancel code</span>
        <input
          name="code"
          defaultValue={initialCode}
          required
          autoComplete="off"
          className="mt-1 w-full rounded border px-2 py-1 font-mono uppercase"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded border px-3 py-1">
        {pending ? "Cancelling..." : "Cancel booking"}
      </button>
    </form>
  );
}
