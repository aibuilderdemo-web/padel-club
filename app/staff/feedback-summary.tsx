"use client";

import { useState, useTransition } from "react";
import { summariseFeedback, type SummaryState } from "./summary-actions";

export function FeedbackSummary() {
  const [state, setState] = useState<SummaryState | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="mt-8">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await summariseFeedback()))}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Summarising..." : "Summarise this week's feedback"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">{state.error}</p>
      )}
      {/* PLANTED WEAKNESS (security video): the model's Markdown is rendered with raw HTML allowed. */}
      {state?.html && (
        <div className="mt-4 rounded border p-3" dangerouslySetInnerHTML={{ __html: state.html }} />
      )}
    </section>
  );
}
