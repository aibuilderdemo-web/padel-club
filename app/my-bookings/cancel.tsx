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

// The "You are a member" box with "Manage membership". The action sends the
// member on to Stripe's portal, or returns the error, which shows under it.
export function ManageMembership({
  action,
}: {
  action: (error: string | null, form: FormData) => Promise<string | null>;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-6 rounded border border-club p-4">
      <p className="text-lg font-semibold text-club">You are a member of the club.</p>
      <p className="mt-1 text-zinc-700">Change your card, see invoices or cancel on Stripe.</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 min-h-11 w-full rounded border border-club px-4 font-semibold text-club hover:bg-club hover:text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Opening Stripe…" : "Manage membership"}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Could not open the membership page: {error}
        </p>
      )}
    </form>
  );
}

// The "Become a member" box. The action sends the user on to Stripe, or
// returns Stripe's error, which shows under the button.
export function BecomeMember({
  action,
}: {
  action: (error: string | null, form: FormData) => Promise<string | null>;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-6 rounded border border-zinc-300 p-4">
      <h2 className="font-heading text-2xl font-bold">Become a member</h2>
      <p className="mt-1 text-zinc-700">A club membership, paid by card on Stripe.</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 min-h-11 w-full rounded bg-club px-4 font-semibold text-white hover:bg-club-dark disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Opening Stripe…" : "Become a member"}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Could not start the payment: {error}
        </p>
      )}
    </form>
  );
}
