import Link from "next/link";
import { logOut } from "@/app/auth/actions";
import { createAuthClient } from "@/lib/supabase/auth";
import { SentryUser } from "./sentry-user";

export async function Nav() {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getUser();
  let isStaff = false;
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    isStaff = profile?.role === "staff" || profile?.role === "admin";
  }
  return (
    <nav className="flex items-center gap-4 border-b px-6 py-2 text-sm">
      <SentryUser id={data.user?.id ?? null} />
      <Link href="/" className="font-medium">Padel Club Navigli</Link>
      <span className="flex-1" />
      {data.user ? (
        <>
          <Link href="/ask" className="underline">Ask the club</Link>
          <Link href="/feedback" className="underline">Feedback</Link>
          <Link href="/my-bookings"className="underline">My bookings</Link>
          <Link href="/profile" className="underline">Profile</Link>
          <Link href="/membership" className="underline">Become a member</Link>
          {isStaff && <Link href="/staff" className="underline">Staff</Link>}
          <form action={logOut}>
            <button type="submit" className="underline">Log out</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="underline">Log in</Link>
          <Link href="/signup" className="underline">Sign up</Link>
        </>
      )}
    </nav>
  );
}
