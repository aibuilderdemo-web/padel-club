"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/auth";

export type ProfileState = { error: string | null; saved?: boolean };

const PHONE = /^\+?[0-9 ]{7,15}$/;

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!fullName) return { error: "Please enter your full name." };
  if (!PHONE.test(phone)) {
    return { error: "Please enter a phone number: digits and spaces, optional + at the start, 7 to 15 characters." };
  }

  // Must be logged in. Only name and phone are sent; the database also refuses role changes by non-admins.
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in to edit your profile." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", auth.user.id)
    .select("id");
  if (error) return { error: `Could not save: ${error.message}` };
  if (!data || data.length === 0) return { error: "Nothing was saved: no profile found for your account." };

  revalidatePath("/profile");
  return { error: null, saved: true };
}
