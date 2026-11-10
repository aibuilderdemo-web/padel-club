import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Link href="/" className="font-heading text-2xl font-bold uppercase tracking-wide">
              Padel Club Navigli
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
