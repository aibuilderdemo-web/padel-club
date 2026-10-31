import "server-only";

// Tells n8n about a new member. Throws on failure or after 5 seconds; the caller logs it and carries on.
export async function notifyNewMember(member: { firstName: string; email: string }) {
  const url = process.env.N8N_NEW_MEMBER_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url) throw new Error("N8N_NEW_MEMBER_URL is not set");
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not set");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify({ firstName: member.firstName, email: member.email, plan: "monthly" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`n8n ${res.status}: ${await res.text()}`);
}
