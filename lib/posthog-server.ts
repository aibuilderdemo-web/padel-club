import "server-only";
import { PostHog } from "posthog-node";

// Server events (the Stripe webhook). Properties must never hold emails, phone numbers or names.
// A short-lived client per call: serverless functions can freeze right after the response,
// so the event is flushed before returning. A failure is logged and never thrown.
export async function captureServer(
  distinctId: string,
  event: "membership_activated",
  properties: Record<string, string | number | boolean | null>,
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    console.error(`PostHog: NEXT_PUBLIC_POSTHOG_KEY is not set, skipped ${event}`);
    return;
  }
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    client.capture({ distinctId, event, properties });
    await client.shutdown();
  } catch (e) {
    console.error(`PostHog ${event} failed:`, e instanceof Error ? e.message : e);
  }
}
