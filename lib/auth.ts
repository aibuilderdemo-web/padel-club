// Accounts: the per-request Supabase client, the logged-in user, sign-up,
// log-in and log-out. Hides Supabase Auth and its cookies.
// Publishable key only; the database decides what each user may do (RLS).
// Supabase errors are thrown with their message.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export type Profile = {
  fullName: string;
  phone: string;
  role: "member" | "staff" | "admin";
  // Has an active Stripe membership (status active or trialing, set by the
  // webhook). Separate from the role.
  paidMember: boolean;
};
export type User = { id: string; email: string; profile: Profile | null };

// A Supabase client that acts as the visitor: a guest, or the logged-in user.
// Server code only. Make a new one for each request.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Pages can't set cookies. proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}

// The logged-in user with their profile, or null for a guest.
// Read once per request, however many components ask.
export const currentUser = cache(async (): Promise<User | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const id = data.claims.sub;
  const profile = await supabase
    .from("profiles")
    .select("full_name, phone, role, membership_status")
    .eq("id", id)
    .maybeSingle();
  if (profile.error) throw new Error(profile.error.message);

  return {
    id,
    email: data.claims.email ?? "",
    profile: profile.data
      ? {
          fullName: profile.data.full_name,
          phone: profile.data.phone,
          role: profile.data.role,
          paidMember: ["active", "trialing"].includes(profile.data.membership_status ?? ""),
        }
      : null,
  };
});

// Staff and admins see the staff page (PERMISSIONS.md).
export function isStaff(user: User | null): boolean {
  return user?.profile?.role === "staff" || user?.profile?.role === "admin";
}

// Changes the logged-in user's name and phone. The database allows only
// these two columns, only on your own row, and refuses blank values.
export async function updateProfile(input: { fullName: string; phone: string }): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error("Please log in to change your profile.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName, phone: input.phone })
    .eq("id", user.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error("Your profile was not found.");
}

// Makes an account. The database makes the profile from fullName and phone.
// Returns true when Supabase wants the email confirmed first.
export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<{ needsConfirmation: boolean }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName, phone: input.phone } },
  });
  if (error) throw new Error(error.message);
  return { needsConfirmation: !data.session };
}

export async function logIn(email: string, password: string): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function logOut(): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// Checks the link from the confirmation email and logs the user in.
export async function confirmEmail(tokenHash: string, type: "email" | "signup"): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw new Error(error.message);
}

// Only paths on this site, so ?next= can't send someone elsewhere.
export function safeNext(next: unknown, fallback = "/my-bookings"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
