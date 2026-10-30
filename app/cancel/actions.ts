"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export type CancelState = { error: string | null };

export async function cancelBooking(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { error: "Please enter your cancel code." };

  const db = createAdminClient();

  const { data: found, error: findError } = await db
    .from("bookings")
    .select("id, cancelled_at")
    .eq("cancel_code", code)
    .maybeSingle();
  if (findError) return { error: `Could not check the code: ${findError.message}` };
  if (!found) return { error: "That code does not match any booking. Nothing was cancelled." };
  if (found.cancelled_at) return { error: "This booking is already cancelled." };

  // The extra is-null filter makes a double click or a second tab cancel only once.
  const { data: updated, error } = await db
    .from("bookings")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", found.id)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { error: `Could not cancel: ${error.message}` };
  if (!updated || updated.length === 0) return { error: "This booking is already cancelled." };

  redirect("/cancel/done");
}
