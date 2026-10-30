"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileState } from "./actions";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, { error: null });
  const input = "mt-1 block w-full rounded border px-2 py-1";
  return (
    <form action={action} className="mt-4 space-y-3">
      {state.error && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      )}
      {state.saved && <p className="rounded border border-green-500 bg-green-50 p-3 text-green-900">Saved.</p>}
      <label className="block">
        Full name
        <input name="full_name" required defaultValue={fullName} className={input} />
      </label>
      <label className="block">
        Phone
        <input name="phone" type="tel" required defaultValue={phone} className={input} />
      </label>
      <button type="submit" disabled={pending} className="rounded border px-3 py-1">
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
