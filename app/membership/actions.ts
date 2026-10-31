"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth";
import { getStripe } from "@/lib/stripe";

export type CheckoutState = { error: string | null };

export async function startCheckout(): Promise<CheckoutState> {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const price = process.env.STRIPE_PRICE_ID;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!price) return { error: "STRIPE_PRICE_ID is not set." };
  if (!site) return { error: "NEXT_PUBLIC_SITE_URL is not set." };

  let url: string | null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: auth.user.id,
      customer_email: auth.user.email,
      metadata: { user_id: auth.user.id },
      subscription_data: { metadata: { user_id: auth.user.id } },
      success_url: `${site}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/membership/cancel`,
    });
    url = session.url;
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!url) return { error: "Stripe did not return a checkout URL." };
  redirect(url);
}

export async function manageMembership(): Promise<CheckoutState> {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return { error: "NEXT_PUBLIC_SITE_URL is not set." };

  // Only the user's own saved customer id is used; it is never taken from the browser.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", auth.user.id)
    .single();
  if (error) return { error: `Profile: ${error.message}` };
  if (!profile.stripe_customer_id) return { error: "You have no membership to manage." };

  let url: string;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${site}/membership`,
    });
    url = session.url;
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : String(e)}` };
  }
  redirect(url);
}
