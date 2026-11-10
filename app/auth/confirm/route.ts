// The link in the sign-up email lands here. Confirms the email, logs the
// user in and sends them to My bookings. On failure, shows why on /login.

import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { confirmEmail } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let failure: string | null = null;
  if (!tokenHash || (type !== "email" && type !== "signup")) {
    failure = "This confirmation link is not complete. Please use the link from the email.";
  } else {
    try {
      await confirmEmail(tokenHash, type);
    } catch (error) {
      failure = `Could not confirm your email: ${(error as Error).message}`;
    }
  }
  redirect(failure ? `/login?error=${encodeURIComponent(failure)}` : "/my-bookings");
}
