"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

// Once per booking per browser tab: reloading the confirmation page must not count it again.
export function BookingCompleted({ bookingId }: { bookingId: string }) {
  useEffect(() => {
    const key = `booking_completed:${bookingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: better to risk a duplicate than to lose the event.
    }
    track("booking_completed", { booking_id: bookingId });
  }, [bookingId]);
  return null;
}
