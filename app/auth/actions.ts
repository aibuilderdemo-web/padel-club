"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth";

export type AuthState = { error: string | null };

const PHONE = /^\+?[0-9 ]{7,15}$/;

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const fullName = get("full_name");
  const phone = get("phone");
  const email = get("email");
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Please enter your full name." };
  if (!PHONE.test(phone)) {
    return { error: "Please enter a phone number: digits and spaces, optional + at the start, 7 to 15 characters." };
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });
  if (error) return { error: `Could not sign up: ${error.message}` };
  if (!data.session) {
    return { error: "Account created. Check your email to confirm it, then log in." };
  }
  redirect("/my-bookings");
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: `Could not log in: ${error.message}` };
  redirect("/my-bookings");
}

export async function logOut() {
  await (await createAuthClient()).auth.signOut();
  redirect("/");
}
