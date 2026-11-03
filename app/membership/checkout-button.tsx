"use client";

import { useActionState } from "react";
import { track } from "@/lib/posthog-client";
import { startCheckout, type CheckoutState } from "./actions";

export function CheckoutButton() {
  const [state, action, pending] = useActionState<CheckoutState>(startCheckout, { error: null });
  return (
    <form action={action} onSubmit={() => track("checkout_started")} className="mt-4 space-y-3">
      {state.error && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded border px-3 py-1">
        {pending ? "Redirecting to Stripe..." : "Become a member"}
      </button>
    </form>
  );
}
