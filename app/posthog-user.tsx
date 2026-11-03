"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

// Tells browser-side PostHog who is logged in: the member ID only, never the email or phone.
export function PostHogUser({ id }: { id: string | null }) {
  useEffect(() => {
    if (!posthog.__loaded) return;
    if (id) posthog.identify(id);
    // Logged out: start a fresh anonymous ID so the next person on this browser is not linked to the last.
    else if (posthog.get_property("$user_state") === "identified") posthog.reset();
  }, [id]);
  return null;
}
