import "server-only";

type Welcome = {
  to: string;
  fullName: string | null;
  amountTotal: number | null;
  currency: string | null;
  invoiceUrl: string | null;
  paidAt: Date;
  manageUrl: string;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Sends the welcome email with Resend. Throws on failure; the caller logs it and carries on.
export async function sendWelcomeEmail(w: Welcome) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const first = w.fullName?.trim().split(/\s+/)[0] || "member";
  const amount =
    w.amountTotal != null && w.currency
      ? new Intl.NumberFormat("en-IE", { style: "currency", currency: w.currency.toUpperCase() }).format(
          w.amountTotal / 100,
        )
      : "see your invoice";
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Rome" }).format(w.paidAt);
  const perks = ["Book a court up to 7 days ahead (guests get 2 days)."];
  const cancel = `Sign in, open Membership and click "Manage membership": ${w.manageUrl}`;

  const text = [
    `Hi ${first},`,
    "",
    "Welcome to Padel Club Navigli!",
    "",
    "What you get:",
    ...perks.map((p) => `- ${p}`),
    "",
    `Amount paid: ${amount}`,
    `Date: ${date}`,
    w.invoiceUrl ? `Invoice: ${w.invoiceUrl}` : "Invoice: available from Manage membership.",
    "",
    `How to cancel: ${cancel}`,
  ].join("\n");

  const html = `<div style="font-family:sans-serif;max-width:32rem">
<h1 style="font-size:1.25rem">Welcome to the club, ${escapeHtml(first)}!</h1>
<p>What you get:</p>
<ul>${perks.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
<p>Amount paid: <strong>${escapeHtml(amount)}</strong><br>Date: ${escapeHtml(date)}</p>
<p>${w.invoiceUrl ? `<a href="${escapeHtml(w.invoiceUrl)}">View your Stripe invoice</a>` : "Your invoice is available from Manage membership."}</p>
<p>How to cancel: sign in, open Membership and click <a href="${escapeHtml(w.manageUrl)}">Manage membership</a>.</p>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: w.to,
      subject: `Welcome to the club, ${first}`,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
