import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET is not set", { status: 500 });

  // The signature is the only authentication: Stripe calls this, not a logged-in user.
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (e) {
    return new Response(`Invalid signature: ${e instanceof Error ? e.message : "unknown"}`, { status: 400 });
  }

  const db = createAdminClient();

  // Claim the event id first; a duplicate delivery hits the primary key and is skipped.
  const { error: claimError } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505") return new Response("Already processed", { status: 200 });
    return new Response(`stripe_events: ${claimError.message}`, { status: 500 });
  }

  try {
    await handle(event, stripe, db);
  } catch (e) {
    // Release the claim so Stripe's retry is processed.
    await db.from("stripe_events").delete().eq("id", event.id);
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Stripe webhook ${event.id} (${event.type}) failed:`, message);
    return new Response(message, { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

type Db = ReturnType<typeof createAdminClient>;

const id = (v: string | { id: string } | null) => (typeof v === "string" ? v : (v?.id ?? null));

async function handle(event: Stripe.Event, stripe: Stripe, db: Db) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return;
      const userId = session.client_reference_id ?? session.metadata?.user_id;
      if (!userId) throw new Error(`Session ${session.id} has no user id`);
      const subscriptionId = id(session.subscription);
      let status = session.payment_status === "paid" ? "active" : null;
      if (subscriptionId) {
        status = (await stripe.subscriptions.retrieve(subscriptionId)).status;
      }
      await update(db, { id: userId }, {
        stripe_customer_id: id(session.customer),
        stripe_subscription_id: subscriptionId,
        ...(status ? { membership_status: status } : {}),
      });
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
      const userId = sub.metadata?.user_id;
      // Fall back to the stored subscription id; either may arrive before checkout.session.completed.
      await update(
        db,
        userId ? { id: userId } : { stripe_subscription_id: sub.id },
        { membership_status: status, stripe_subscription_id: sub.id, stripe_customer_id: id(sub.customer) },
      );
      return;
    }
    default:
      return;
  }
}

async function update(db: Db, match: Record<string, string>, values: Record<string, string | null>) {
  const { data, error } = await db.from("profiles").update(values).match(match).select("id");
  if (error) throw new Error(`profiles: ${error.message}`);
  if (!data?.length) throw new Error(`No profile matches ${JSON.stringify(match)}`);
}
