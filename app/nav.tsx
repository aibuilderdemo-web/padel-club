import Link from "next/link";
import { logOut } from "@/app/auth/actions";
import { createAuthClient } from "@/lib/supabase/auth";

export async function Nav() {
  const { data } = await (await createAuthClient()).auth.getUser();
  return (
    <nav className="flex items-center gap-4 border-b px-6 py-2 text-sm">
      <Link href="/" className="font-medium">Padel Club Navigli</Link>
      <span className="flex-1" />
      {data.user ? (
        <>
          <Link href="/my-bookings" className="underline">My bookings</Link>
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
