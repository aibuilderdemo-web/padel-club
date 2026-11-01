"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "./actions";

export function FeedbackForm() {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, { error: null });
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      )}
      {state.sent && <p className="rounded border border-green-500 bg-green-50 p-3 text-green-900">Thank you, sent.</p>}
      <label htmlFor="comment">Your feedback</label>
      <textarea id="comment" name="comment" required rows={4} maxLength={2000} className="rounded border p-2" />
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
