import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAuthClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import { costOf } from "@/prices.js";

const MODEL = "claude-haiku-5-5";
const FALLBACK = "I can't answer that right now. Please ask at reception.";
const PROMISES = ["free", "refund guaranteed", "exception"];
const DAILY_LIMIT = 20;
const LIMIT_MESSAGE = "You've asked 20 questions today, the daily limit. Ask again tomorrow, or ask the desk.";
const PHONE_OR_EMAIL = /\+?\d[\d ]{8,}\d|\S+@\S+\.\S+/;

function checkAnswer(answer: string): string[] {
  const problems: string[] = [];
  if (!/\(rule \d+\)/i.test(answer)) problems.push("no (rule N) citation");
  const lower = answer.toLowerCase();
  for (const word of PROMISES) {
    if (lower.includes(word)) problems.push(`promise word: ${word}`);
  }
  if (PHONE_OR_EMAIL.test(answer)) problems.push("phone number or email");
  return problems;
}

function fallback(reason: string) {
  console.error(`[ask] fallback: ${reason}`);
  return Response.json({ answer: FALLBACK }, { status: 200 });
}

type Usage = { input_tokens: number; output_tokens: number };

// One ai_usage row per call that reached the model. A failed log never fails the answer.
async function logUsage(userId: string, usage: Usage, started: number, outcome: "answered" | "fallback") {
  const { error } = await createAdminClient().from("ai_usage").insert({
    user_id: userId,
    feature: "ask_the_club",
    model: MODEL,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost: costOf(MODEL, usage),
    duration_ms: Date.now() - started,
    outcome,
  });
  if (error) console.error(`[ask] usage not logged: ${error.message}`);
}

export async function POST(request: Request) {
  // Browser: session cookies. Scripts (run_eval.js): "Authorization: Bearer <access token>".
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  const supabase = bearer ? createPublicClient() : await createAuthClient();
  const { data: auth } = await (bearer ? supabase.auth.getUser(bearer) : supabase.auth.getUser());
  if (!auth.user) {
    return Response.json({ error: "Log in to ask the club." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Write a question first." }, { status: 400 });
  }

  // Count first, in one database step, so two requests at the same moment can't both pass.
  const { data: n, error: countError } = await createAdminClient().rpc("ai_count_question", { p_user: auth.user.id });
  if (countError) {
    return Response.json({ error: `Could not check the daily limit: ${countError.message}` }, { status: 500 });
  }
  if (n > DAILY_LIMIT) {
    return Response.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  const root = process.cwd();
  const template = await readFile(path.join(root, "prompts/ask-the-club.txt"), "utf8");
  const rules = await readFile(path.join(root, "club-rules.md"), "utf8");
  const system = template.replace("{club-rules.md}", () => rules);

  const started = Date.now();
  let data;
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
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: question }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return fallback(`Anthropic API ${res.status}: ${await res.text()}`);
    }
    data = await res.json();
  } catch (e) {
    return fallback(`Anthropic call failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const answer = (data.content as { type: string; text?: string }[])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const problems = checkAnswer(answer);
  await logUsage(auth.user.id, data.usage, started, problems.length > 0 ? "fallback" : "answered");
  if (problems.length > 0) {
    return fallback(`answer failed check: ${problems.join("; ")}`);
  }
  return Response.json({ answer, usage: data.usage });
}
