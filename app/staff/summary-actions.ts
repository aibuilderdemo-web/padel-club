"use server";

import { Marked } from "marked";
import { milanDayBounds, todayInMilan } from "@/lib/slots";
import { createAuthClient } from "@/lib/supabase/auth";

export type SummaryState = { error: string | null; html?: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The model's output is untrusted (it repeats member comments). Raw HTML is shown as plain text,
// images are never loaded (only their alt text is shown), and links must be http(s) or mailto.
const markdown = new Marked({
  renderer: {
    html: ({ text }) => escapeHtml(text),
    image: ({ text }) => escapeHtml(text),
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:)/i.test(href)) return label;
      return `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${label}</a>`;
    },
  },
});

const MODEL = "claude-haiku-5-5";

const SYSTEM = `You help the staff of Padel Club Navigli. You get this week's member feedback.
Write a short summary in Markdown for the staff: the main themes, then each comment quoted as written,
with the member's name and phone number beside it so staff can call back.`;

// Monday of the current week, as a Milan date (YYYY-MM-DD).
function mondayInMilan(): string {
  const today = todayInMilan();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function summariseFeedback(): Promise<SummaryState> {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "staff" && profile?.role !== "admin") return { error: "Staff only." };

  const { data, error } = await supabase
    .from("feedback")
    .select("comment, created_at, profiles(full_name, phone)")
    .gte("created_at", milanDayBounds(mondayInMilan()).from)
    .order("created_at");
  if (error) return { error: `Feedback: ${error.message}` };
  if (data.length === 0) return { error: "No feedback this week." };

  // Every comment goes to the model together with the member's name and phone.
  const text = data
    .map((f, i) => {
      const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
      return `${i + 1}. ${p?.full_name ?? "Unknown"} (${p?.phone ?? "no phone"}): ${f.comment}`;
    })
    .join("\n");

  let answer: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: "user", content: text }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { error: `Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}` };
    const json = await res.json();
    answer = (json.content as { type: string; text?: string }[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (e) {
    return { error: `Anthropic call failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  return { error: null, html: await markdown.parse(answer) };
}
