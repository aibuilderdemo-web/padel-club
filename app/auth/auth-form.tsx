"use client";

import { useActionState } from "react";
import type { AuthState } from "./actions";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({ action, signup }: { action: Action; signup?: boolean }) {
  const [state, run, pending] = useActionState<AuthState, FormData>(action, { error: null });
  const input = "mt-1 block w-full rounded border px-2 py-1";
  return (
    <form action={run} className="mt-4 space-y-3">
      {state.error && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      )}
      {signup && (
        <>
          <label className="block">
            Full name
            <input name="full_name" required className={input} />
          </label>
          <label className="block">
            Phone
            <input name="phone" type="tel" required placeholder="+39 333 1234567" className={input} />
          </label>
        </>
      )}
      <label className="block">
        Email
        <input name="email" type="email" required className={input} />
      </label>
      <label className="block">
        Password
        <input name="password" type="password" required minLength={6} className={input} />
      </label>
      <button type="submit" disabled={pending} className="rounded border px-3 py-1">
        {pending ? "Please wait..." : signup ? "Sign up" : "Log in"}
      </button>
    </form>
  );
}
