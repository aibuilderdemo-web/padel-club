import "server-only";
import { Resend } from "resend";

type Receipt = { to: string; name: string; startsAt: Date; courtId: number; reference: string };

// Sends the booking receipt with Resend. The SDK logs a rejected key and does not throw;
// a booking never fails because its receipt did.
export async function sendBookingReceipt(r: Receipt) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("Booking receipt not sent: RESEND_API_KEY is not set");
    return;
  }
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" }).format(
    r.startsAt,
  );
  const { error } = await new Resend(key).emails.send({
    from: "onboarding@resend.dev",
    to: r.to,
    subject: `Booking receipt: court ${r.courtId}, ${when}`,
    text: `Hi ${r.name},\n\nYour booking is confirmed.\n\nCourt ${r.courtId}\n${when}\nReference: ${r.reference}\n`,
  });
  if (error) console.error("[Resend API Error]:", error);
}
