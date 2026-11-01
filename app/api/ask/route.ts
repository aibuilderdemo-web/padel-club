import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAuthClient } from "@/lib/supabase/auth";
import { createPublicClient } from "@/lib/supabase/server";

const MODEL = "claude-haiku-5-5";

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

  const root = process.cwd();
  const template = await readFile(path.join(root, "prompts/ask-the-club.txt"), "utf8");
  const rules = await readFile(path.join(root, "club-rules.md"), "utf8");
  const system = template.replace("{club-rules.md}", () => rules);

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
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const answer = (data.content as { type: string; text?: string }[])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  return Response.json({ answer, usage: data.usage });
}
