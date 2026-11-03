import posthog from "posthog-js";

// Browser events. Properties must never hold emails, phone numbers or names: IDs and counts only.
export type BrowserEvent = "slot_viewed" | "booking_completed" | "checkout_started" | "ask_question";

export function track(event: BrowserEvent, properties?: Record<string, string | number | boolean>) {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}
