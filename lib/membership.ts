// Stripe subscription statuses that count as an active membership.
// Keep in sync with bookings_horizon() in supabase/migrations/0008_membership.sql,
// which also gives staff and admin the 7-day window.
export function isActiveMember(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
