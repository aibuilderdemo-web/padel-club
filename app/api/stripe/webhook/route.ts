import { handleStripeWebhook, WebhookSignatureError } from "@/lib/membership";

// Stripe calls this after a checkout and when a subscription changes. There is
// no logged-in user: the Stripe signature, checked in handleStripeWebhook(),
// is the only proof the call is real. 400 = not from Stripe; 500 = Stripe
// should send it again, and shows the message in its dashboard.
export async function POST(request: Request) {
  // The raw body, unparsed: the signature is over these exact bytes.
  const rawBody = await request.text();
  try {
    const result = await handleStripeWebhook(rawBody, request.headers.get("stripe-signature"));
    return Response.json({ received: true, result });
  } catch (error) {
    const message = (error as Error).message;
    if (error instanceof WebhookSignatureError) {
      return Response.json({ error: `Bad signature: ${message}` }, { status: 400 });
    }
    console.error("Stripe webhook failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
