"use server";

import { redirect } from "next/navigation";
import { parseSlot } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookState = { error: string | null };

const PHONE = /^\+?[0-9 ]{7,15}$/;

export async function bookSlot(_prev: BookState, formData: FormData): Promise<BookState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const phone = get("phone");
  const courtId = Number(get("court"));

  if (!name) return { error: "Please enter your name." };
  if (!PHONE.test(phone)) {
    return { error: "Please enter a phone number: digits and spaces, optional + at the start, 7 to 15 characters." };
  }
  const startsAt = parseSlot(get("date"), get("time"));
  if (!startsAt || !Number.isInteger(courtId)) {
    return { error: "That slot is no longer available to book." };
  }

  const { data, error } = await createAdminClient()
    .from("bookings")
    .insert({
      court_id: courtId,
      starts_at: startsAt.toISOString(),
      guest_name: name,
      phone,
    })
    .select("public_id")
    .single();

  if (error) {
    // 23P01 = exclusion_violation: the no-overlap rule in the database refused it.
    if (error.code === "23P01") {
      return {
        error: `Sorry, that court is already booked at that time. Please go back and pick another slot. (Database: ${error.message})`,
      };
    }
    return { error: `Could not book: ${error.message}` };
  }
  redirect(`/confirmation/${data.public_id}`);
}
