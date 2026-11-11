import { NextResponse } from "next/server";
import { milanDayBounds, formatMilan, todayInMilan } from "@/lib/slots";
import { createAuthClient } from "@/lib/supabase/auth";

// Staff and admin only: court, time and first name for today. 401 for everyone else.
export async function GET() {
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Log in as staff" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "staff" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }

  const { from, to } = milanDayBounds(todayInMilan());
  const { data, error } = await supabase
    .from("bookings")
    .select("starts_at, guest_name, user_id, courts(name)")
    .is("cancelled_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at")
    .order("court_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set(data.flatMap((b) => (b.user_id ? [b.user_id] : [])))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.full_name);
  }

  return NextResponse.json(
    data.map((b) => {
      const court = Array.isArray(b.courts) ? b.courts[0] : b.courts;
      const full = (b.user_id ? names.get(b.user_id) : b.guest_name) ?? "";
      return { court: court?.name, time: formatMilan(new Date(b.starts_at)).time, name: full.split(" ")[0] };
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
