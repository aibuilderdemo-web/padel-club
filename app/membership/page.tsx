import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAuthClient } from "@/lib/supabase/auth";
import { CheckoutButton } from "./checkout-button";

export default function MembershipPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Membership</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  return <CheckoutButton />;
}
