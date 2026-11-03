"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Tells browser-side Sentry who is logged in: the member ID only, never the email.
export function SentryUser({ id }: { id: string | null }) {
  useEffect(() => {
    Sentry.setUser(id ? { id } : null);
  }, [id]);
  return null;
}
