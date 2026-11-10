"use client";

import { useActionState } from "react";

// Log-in and sign-up forms. The pages pass the server actions in.
// Each action returns an error message, a done message, or nothing.

export type AccountState = { error: string | null; done: string | null; values: Record<string, string> };
type Action = (state: AccountState, form: FormData) => Promise<AccountState>;

const empty: AccountState = { error: null, done: null, values: {} };

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  value,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  value?: string;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        defaultValue={value}
        className="min-h-12 rounded border border-zinc-400 px-3 text-lg"
      />
    </label>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
      {message}
    </p>
  ) : null;
}

function Submit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded bg-club px-6 text-lg font-semibold text-white hover:bg-club-dark disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function LoginForm({ action, next }: { action: Action; next: string }) {
  const [state, formAction, pending] = useActionState(action, empty);
  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" value={state.values.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <ErrorBox message={state.error && `Could not log in: ${state.error}`} />
      <Submit pending={pending} label="Log in" pendingLabel="Logging in…" />
    </form>
  );
}

export function SignupForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, empty);
  if (state.done) {
    return (
      <p role="status" className="mt-6 rounded border border-zinc-300 bg-zinc-50 p-4 text-lg">
        {state.done}
      </p>
    );
  }
  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <Field label="Full name" name="full_name" autoComplete="name" value={state.values.full_name} />
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" value={state.values.phone} />
      <Field label="Email" name="email" type="email" autoComplete="email" value={state.values.email} />
      <Field label="Password (at least 8 characters)" name="password" type="password" autoComplete="new-password" minLength={8} />
      <ErrorBox message={state.error && `Could not sign up: ${state.error}`} />
      <Submit pending={pending} label="Sign up" pendingLabel="Signing up…" />
    </form>
  );
}
