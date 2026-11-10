import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser, isStaff, logOut } from "@/lib/auth";
import "./globals.css";

async function logOutAction() {
  "use server";
  await logOut();
  redirect("/");
}

// Log in, or My bookings and Log out, plus Staff for staff and admins.
// Reads the login cookie, so it sits in its own Suspense and the rest of
// the page doesn't wait for it. Hiding the link is only for tidiness: what
// staff may read is decided by RLS in the database.
async function AccountLinks() {
  const user = await currentUser().catch(() => null);
  if (!user) {
    return (
      <Link href="/login" className="flex min-h-11 items-center whitespace-nowrap text-club underline">
        Log in
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4">
      {isStaff(user) && (
        <Link href="/staff" className="flex min-h-11 items-center whitespace-nowrap text-club underline">
          Staff
        </Link>
      )}
      <Link href="/my-bookings" className="flex min-h-11 items-center whitespace-nowrap text-club underline">
        My bookings
      </Link>
      <form action={logOutAction}>
        <button type="submit" className="min-h-11 whitespace-nowrap text-club underline">
          Log out
        </button>
      </form>
    </div>
  );
}

const heading = Barlow_Condensed({
  variable: "--font-heading-face",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Padel Club Navigli",
  description: "Book a padel court at Padel Club Navigli, Milan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${heading.variable} ${text.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-base">
        <header className="border-b border-zinc-200">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="font-heading text-2xl font-bold uppercase tracking-wide">
              Padel Club Navigli
            </Link>
            <Suspense fallback={null}>
              <AccountLinks />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
