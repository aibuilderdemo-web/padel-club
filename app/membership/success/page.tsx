import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAuthClient } from "@/lib/supabase/auth";

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Thank you</h1>
      <Suspense fallback={null}>
        <Message />
      </Suspense>
    </main>
  );
}

// Does not change the membership: that will come from a verified Stripe webhook.
async function Message() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  return (
    <p className="mt-4">
      Your membership will be active in a moment.
    </p>
  );
}
