import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAuthClient } from "@/lib/supabase/auth";
import { FeedbackForm } from "./feedback-form";

export default function FeedbackPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Feedback</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  return <FeedbackForm />;
}
