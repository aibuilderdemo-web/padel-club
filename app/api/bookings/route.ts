import { NextResponse } from "next/server";
import { dayWindow, formatMilan, todayInMilan } from "@/lib/slots";
import { createPublicClient } from "@/lib/supabase/server";

// Public: today's bookings, court and time only. No names, no ids.
// CORS open on purpose: the Expo web preview runs on another origin (localhost:8081).
const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}

export async function GET() {
  const supabase = createPublicClient();
  const { from, to } = dayWindow(todayInMilan());
  const [{ data: courts }, { data, error }] = await Promise.all([
    supabase.from("courts").select("id, name"),
    supabase.rpc("taken_slots", { from_ts: from, to_ts: to }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });

  const names = new Map((courts ?? []).map((c) => [c.id, c.name]));
  const rows = ((data ?? []) as { court_id: number; starts_at: string }[])
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.court_id - b.court_id)
    .map((b) => ({ court: names.get(b.court_id), time: formatMilan(new Date(b.starts_at)).time }));
  return NextResponse.json(rows, { headers });
}
