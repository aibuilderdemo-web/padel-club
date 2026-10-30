import "server-only";
import Stripe from "stripe";

// Secret-key Stripe client. Server code only.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}
