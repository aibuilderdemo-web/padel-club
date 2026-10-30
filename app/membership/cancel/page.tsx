import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
      <p className="mt-4">Nothing was charged.</p>
      <Link href="/membership" className="mt-4 inline-block underline">Try again</Link>
    </main>
  );
}
