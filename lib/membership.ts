// Paid membership: a Stripe subscription, separate from the "member" role.
// Hides Stripe and the one database write that needs the secret key.
// Server code only: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and
// SUPABASE_SECRET_KEY must never reach the browser. Stripe and Supabase
// errors are thrown with their message.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { User } from "./auth";

function stripeConfig(): { stripe: Stripe; priceId: string } {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set on the server.");
  if (!priceId) throw new Error("STRIPE_PRICE_ID is not set on the server.");
  return { stripe: new Stripe(secretKey), priceId };
}

// Starts a Stripe Checkout for the membership subscription, linked to the
// user by their id. Returns the Stripe page to send them to. origin is this
// site's address, for the success and cancel pages. The membership switches
// on when Stripe calls the webhook, not on the success page.
export async function startCheckout(user: User, origin: string): Promise<string> {
  if (user.profile?.paidMember) throw new Error("You are already a member.");
  const { stripe, priceId } = stripeConfig();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    customer_email: user.email || undefined,
    success_url: `${origin}/membership/success`,
    cancel_url: `${origin}/membership/cancel`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout page.");
  return session.url;
}

// The request did not come from Stripe: missing or wrong signature.
export class WebhookSignatureError extends Error {}

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

// Handles one call to /api/stripe/webhook. Checks the signature with
// STRIPE_WEBHOOK_SECRET, then saves the user's membership status and Stripe
// ids. Each event is applied once; a resent one changes nothing. Returns a
// short note for Stripe's dashboard.
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<string> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set on the server.");
  const { stripe } = stripeConfig();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("No Stripe-Signature header.");
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    throw new WebhookSignatureError((error as Error).message);
  }

  if (!HANDLED_EVENTS.has(event.type)) return `ignored ${event.type}`;

  // The user and subscription this event is about.
  let userId: string | null | undefined;
  let subscriptionId: string | null | undefined;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return "ignored: not a subscription checkout";
    userId = session.client_reference_id;
    subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  } else {
    const subscription = event.data.object as Stripe.Subscription;
    userId = subscription.metadata?.user_id;
    subscriptionId = subscription.id;
  }

  if (!userId || !subscriptionId) {
    // Made outside this app (e.g. in the Stripe dashboard): no user to update,
    // and sending it again wouldn't help.
    console.error(`Stripe event ${event.id} (${event.type}) has no user id or subscription; skipped.`);
    return "skipped: no user id or subscription";
  }

  // Ask Stripe for the subscription as it is now, so events that arrive late
  // or out of order never leave an old status behind.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const { data: applied, error } = await adminClient().rpc("apply_stripe_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: userId,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_status: subscription.status,
  });
  if (error) throw new Error(error.message);
  return applied ? `applied ${event.type}: ${subscription.status}` : "duplicate, skipped";
}

// Supabase with the secret key: skips RLS. Used only above, after Stripe's
// signature has been checked.
function adminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set on the server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
