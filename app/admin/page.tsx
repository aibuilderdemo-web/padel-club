import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { milanDayBounds, todayInMilan } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/auth";

// The Monday numbers. Admin and staff only: everyone else goes to the home page.
// The role is checked as the logged-in user; the counts then use the secret key.
export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">The numbers</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-600">Loading...</p>}>
        <Numbers />
      </Suspense>
    </main>
  );
}

// Monday of this week in Milan, as YYYY-MM-DD.
function mondayInMilan(): string {
  const today = new Date(`${todayInMilan()}T12:00:00Z`);
  today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return today.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function Numbers() {
  // Render at request time: "this week" must not be frozen at build time.
  await connection();

  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "staff" && profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { from } = milanDayBounds(mondayInMilan());
  const [bookings, members, costs] = await Promise.all([
    admin.from("bookings").select("id", { count: "exact", head: true }).is("cancelled_at", null).gte("created_at", from),
    admin.from("profiles").select("id", { count: "exact", head: true }).in("membership_status", ["active", "trialing"]),
    admin.from("ai_cost_per_member").select("total_cost"),
  ]);
  const error = bookings.error ?? members.error ?? costs.error;
  if (error) {
    return (
      <p role="alert" className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">
        Numbers: {error.message}
      </p>
    );
  }

  const cards = [
    { label: "Bookings this week", value: String(bookings.count ?? 0), note: "Made since Monday 00:00, Milan time, not cancelled" },
    { label: "Active members", value: String(members.count ?? 0), note: "Membership active or trialing" },
    { label: "AI cost per member", value: `$${median((costs.data ?? []).map((r) => Number(r.total_cost))).toFixed(4)}`, note: "Median of each member's total, all time" },
  ];
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded border p-4">
          <p className="text-sm text-zinc-600">{c.label}</p>
          <p className="mt-1 text-3xl font-semibold">{c.value}</p>
          <p className="mt-2 text-xs text-zinc-500">{c.note}</p>
        </div>
      ))}
    </div>
  );
}
