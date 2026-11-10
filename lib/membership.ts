// Paid membership: a Stripe subscription, separate from the "member" role.
// Hides Stripe. Server code only: it uses STRIPE_SECRET_KEY, which must
// never reach the browser. Stripe errors are thrown with their message.

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
// site's address, for the success and cancel pages.
// Paying doesn't switch the membership on yet.
export async function startCheckout(user: User, origin: string): Promise<string> {
  const { stripe, priceId } = stripeConfig();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    customer_email: user.email || undefined,
    success_url: `${origin}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/membership/cancel`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout page.");
  return session.url;
}
