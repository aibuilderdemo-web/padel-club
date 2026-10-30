"use client";

import { useActionState } from "react";
import { cancelOwn, type CancelOwnState } from "./actions";

export function CancelButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState<CancelOwnState, FormData>(cancelOwn, { error: null });
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="rounded border px-2 py-0.5 text-sm">
        {pending ? "Cancelling..." : "Cancel"}
      </button>
      {state.error && <span role="alert" className="ml-2 text-sm text-red-800">{state.error}</span>}
    </form>
  );
}
