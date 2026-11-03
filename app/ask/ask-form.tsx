"use client";

import { useState } from "react";
import { track } from "@/lib/posthog-client";

export function AskForm() {
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = new FormData(event.currentTarget).get("question");
    // The question text is not sent: it can contain names or phone numbers.
    track("ask_question", { question_length: String(question ?? "").length });
    setPending(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text.slice(0, 500)}`);
      }
      setAnswer((await res.json()).answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label htmlFor="question">Your question</label>
        <textarea id="question" name="question" required rows={3} className="rounded border p-2" />
        <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
          {pending ? "Asking..." : "Ask"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">{error}</p>
      )}
      {answer && <p className="mt-4 whitespace-pre-wrap rounded border p-3">{answer}</p>}
    </>
  );
}
