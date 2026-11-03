import type Stripe from "stripe";
import { firstNameOf, isActiveMember } from "@/lib/membership";
import { notifyNewMember } from "@/lib/n8n";
import { captureServer } from "@/lib/posthog-server";
import { getStripe } from "@/lib/stripe";
import { sendWelcomeEmail } from "@/lib/welcome-email";
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
      const profile = await update(db, { id: userId }, {
        stripe_customer_id: id(session.customer),
        stripe_subscription_id: subscriptionId,
        ...(status ? { membership_status: status } : {}),
      });
      if (isActiveMember(status)) {
        await captureServer(userId, "membership_activated", {
          subscription_status: status,
          amount_total: session.amount_total,
          currency: session.currency,
        });
        await welcome(stripe, session, profile.full_name);
        await tellN8n(session, profile.full_name);
      }
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
  const { data, error } = await db.from("profiles").update(values).match(match).select("id, full_name");
  if (error) throw new Error(`profiles: ${error.message}`);
  if (!data?.length) throw new Error(`No profile matches ${JSON.stringify(match)}`);
  return data[0];
}

// A failed email is logged and never fails the webhook (the membership is already saved).
async function welcome(stripe: Stripe, session: Stripe.Checkout.Session, fullName: string | null) {
  try {
    const to = session.customer_details?.email ?? session.customer_email;
    if (!to) throw new Error(`Session ${session.id} has no email`);
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
    const invoiceId = id(session.invoice);
    const invoice = invoiceId ? await stripe.invoices.retrieve(invoiceId) : null;
    await sendWelcomeEmail({
      to,
      fullName,
      amountTotal: session.amount_total,
      currency: session.currency,
      invoiceUrl: invoice?.hosted_invoice_url ?? null,
      paidAt: new Date(session.created * 1000),
      manageUrl: `${site}/membership`,
    });
  } catch (e) {
    console.error(`Welcome email for session ${session.id} failed:`, e instanceof Error ? e.message : e);
  }
}

// Runs after the welcome email, even if that failed. Logged and ignored on failure or after 5 seconds.
async function tellN8n(session: Stripe.Checkout.Session, fullName: string | null) {
  try {
    const email = session.customer_details?.email ?? session.customer_email;
    if (!email) throw new Error(`Session ${session.id} has no email`);
    await notifyNewMember({ firstName: firstNameOf(fullName), email });
  } catch (e) {
    console.error(`n8n notification for session ${session.id} failed:`, e instanceof Error ? e.message : e);
  }
}
