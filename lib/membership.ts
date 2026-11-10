// Paid membership: a Stripe subscription, separate from the "member" role.
// Hides Stripe and the one database write that needs the secret key.
// Server code only: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and
// SUPABASE_SECRET_KEY must never reach the browser. Stripe and Supabase
// errors are thrown with their message.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { supabaseServer, type User } from "./auth";

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

// Opens Stripe's customer portal (change card, see invoices, cancel) for an
// active member. Uses the Stripe customer id the webhook saved, read as the
// user, so RLS only ever gives their own. Returns the Stripe page to send
// them to; Stripe sends them back to My bookings.
export async function openCustomerPortal(user: User, origin: string): Promise<string> {
  if (!user.profile?.paidMember) throw new Error("Only members with an active membership can manage it.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.stripe_customer_id) throw new Error("No Stripe customer is saved for your account.");

  const { stripe } = stripeConfig();
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/my-bookings`,
  });
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
// short note for Stripe's dashboard. When a checkout switches a membership
// on, it also sends the welcome email. origin is this site's address, for the
// link in that email.
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  origin: string,
): Promise<string> {
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
  if (!applied) return "duplicate, skipped";

  // Only for the checkout that switched the membership on, and only once:
  // a resent event stops at "duplicate" above. First the welcome email, then
  // n8n. Each failure is logged and never fails the webhook, or Stripe would
  // resend and both would go twice.
  let note = "";
  if (event.type === "checkout.session.completed" && ACTIVE_STATUSES.includes(subscription.status)) {
    const member = newMemberContact(userId);
    member.catch(() => {}); // Reported by the steps below, not as unhandled.
    const step = (name: string, work: Promise<void>) =>
      work.then(
        () => `, ${name} sent`,
        (error: Error) => {
          console.error(`${name} for user ${userId} (Stripe event ${event.id}) failed:`, error.message);
          return `, ${name} failed: ${error.message}`;
        },
      );
    note += await step("welcome email", sendWelcomeEmail(member, subscription, origin));
    note += await step("n8n new member", notifyN8nNewMember(member));
  }
  return `applied ${event.type}: ${subscription.status}${note}`;
}

const ACTIVE_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing"];

type MemberContact = { email: string; firstName: string };

// The new member's account email and first name (first word of the profile
// name, "" if none), read with the secret key.
async function newMemberContact(userId: string): Promise<MemberContact> {
  const admin = adminClient();
  const [account, profile] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  if (account.error) throw new Error(account.error.message);
  if (profile.error) throw new Error(profile.error.message);
  const email = account.data.user?.email;
  if (!email) throw new Error("The account has no email address.");
  return { email, firstName: (profile.data?.full_name ?? "").trim().split(/\s+/)[0] ?? "" };
}

// Tells n8n about the new member: POST to N8N_NEW_MEMBER_URL with the
// x-webhook-secret header from N8N_WEBHOOK_SECRET. Gives up after 5 seconds.
// Throws on any failure; the caller logs it.
async function notifyN8nNewMember(memberPromise: Promise<MemberContact>): Promise<void> {
  const url = process.env.N8N_NEW_MEMBER_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url) throw new Error("N8N_NEW_MEMBER_URL is not set on the server.");
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not set on the server.");
  const member = await memberPromise;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ firstName: member.firstName, email: member.email, plan: "monthly" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    if ((error as Error).name === "TimeoutError") throw new Error("n8n did not answer within 5 seconds.");
    throw error;
  }
  if (!response.ok) {
    throw new Error(`n8n answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}

// The welcome email, sent with Resend (RESEND_API_KEY) to the account's email:
// what members get, the amount paid, the date, Stripe's invoice link and how
// to cancel. HTML and plain text. Throws on any failure; the caller logs it.
async function sendWelcomeEmail(
  memberPromise: Promise<MemberContact>,
  subscription: Stripe.Subscription,
  origin: string,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY is not set on the server.");

  const member = await memberPromise;
  const to = member.email;
  const firstName = member.firstName || "there";

  const invoiceId =
    typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id;
  if (!invoiceId) throw new Error("Stripe returned no invoice for the subscription.");
  const invoice = await stripeConfig().stripe.invoices.retrieve(invoiceId);

  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: invoice.currency.toUpperCase() }).format(
    invoice.amount_paid / 100,
  );
  const paidAt = new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000);
  const date = paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });
  const invoiceUrl = invoice.hosted_invoice_url ?? null;
  const myBookingsUrl = `${origin}/my-bookings`;

  const subject = `Welcome to the club, ${firstName}`;
  const text = [
    `Hello ${firstName},`,
    "",
    "Welcome to Padel Club Navigli. Your membership is active.",
    "",
    "What members get:",
    "- Book any of our 4 courts up to 7 days ahead (guests: 2 days).",
    "- All your bookings in one place on My bookings, where you can cancel them.",
    "",
    `Amount paid: ${amount}`,
    `Date: ${date}`,
    invoiceUrl ? `Invoice: ${invoiceUrl}` : "Invoice: in the Stripe portal (see below).",
    "",
    "How to cancel: log in, open My bookings, press \"Manage membership\" and cancel on the Stripe page.",
    myBookingsUrl,
    "",
    "See you on court,",
    "Padel Club Navigli",
  ].join("\n");

  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#18181b;background:#ffffff">
<div style="max-width:520px;margin:0 auto">
<h1 style="font-size:24px;margin:0 0 16px">Welcome to the club, ${e(firstName)}</h1>
<p>Welcome to Padel Club Navigli. Your membership is active.</p>
<h2 style="font-size:18px;margin:24px 0 8px">What members get</h2>
<ul style="padding-left:20px;margin:0">
<li>Book any of our 4 courts up to 7 days ahead (guests: 2 days).</li>
<li>All your bookings in one place on My bookings, where you can cancel them.</li>
</ul>
<h2 style="font-size:18px;margin:24px 0 8px">Your payment</h2>
<p style="margin:0">Amount paid: <strong>${e(amount)}</strong><br>Date: ${e(date)}</p>
${invoiceUrl ? `<p><a href="${e(invoiceUrl)}" style="color:#1f6f3a">View your invoice</a></p>` : ""}
<h2 style="font-size:18px;margin:24px 0 8px">How to cancel</h2>
<p style="margin:0">Log in, open <a href="${e(myBookingsUrl)}" style="color:#1f6f3a">My bookings</a>, press "Manage membership" and cancel on the Stripe page.</p>
<p style="margin-top:24px">See you on court,<br>Padel Club Navigli</p>
</div></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Padel Club Navigli <onboarding@resend.dev>", to: [to], subject, html, text }),
  });
  if (!response.ok) {
    throw new Error(`Resend answered ${response.status}: ${await response.text()}`);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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
