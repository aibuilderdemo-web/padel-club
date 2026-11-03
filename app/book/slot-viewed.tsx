"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";

export function SlotViewed({ courtId, date, time }: { courtId: string; date: string; time: string }) {
  useEffect(() => {
    track("slot_viewed", { court_id: courtId, date, time });
  }, [courtId, date, time]);
  return null;
}
