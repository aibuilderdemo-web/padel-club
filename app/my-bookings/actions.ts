"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/auth";

export type CancelOwnState = { error: string | null };

// Runs as the logged-in user: the database policy only lets them cancel their own rows.
export async function cancelOwn(_prev: CancelOwnState, formData: FormData): Promise<CancelOwnState> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Unknown booking." };
  const { data, error } = await (await createAuthClient())
    .from("bookings")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { error: `Could not cancel: ${error.message}` };
  if (!data || data.length === 0) return { error: "Nothing was cancelled (already cancelled, or not your booking)." };
  revalidatePath("/my-bookings");
  return { error: null };
}
