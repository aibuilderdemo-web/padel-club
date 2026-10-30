import Link from "next/link";
import { Suspense } from "react";
import { CancelForm } from "./cancel-form";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function CancelPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Cancel a booking</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
      <p className="mt-4"><Link href="/" className="underline">Back to free slots</Link></p>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const code = (await searchParams).code;
  return <CancelForm initialCode={typeof code === "string" ? code : ""} />;
}
