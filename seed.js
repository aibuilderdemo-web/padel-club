// seed.js: fake "Ask the club" usage for September 2026, for the 40 test members (m_01 to m_40).
// Fixed random seed, so every run inserts the same rows. Run it once: it doesn't delete first.
import { createClient } from "@supabase/supabase-js";
import { costOf } from "./prices.js";

process.loadEnvFile(".env.local");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// mulberry32: a small random generator with a seed.
let state = 23;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

// Questions per member per day.
function questions(code, day) {
  if (code === "m_17") return day < 21 ? between(1, 3) : between(1950, 2069);
  if (code === "m_31" || code === "m_04") return between(6, 14);
  return Math.floor(random() * 3.4);
}

// A Milan time between 08:00 and 22:00 on a September 2026 day (Milan is UTC+2 in September).
function when(day) {
  const minutes = 8 * 60 + random() * 14 * 60;
  return new Date(Date.UTC(2026, 8, day, 0, 0) + (minutes - 120) * 60_000).toISOString();
}

const { data: members, error } = await supabase.from("members").select("id, code").like("code", "m_%").order("code");
if (error) throw error;

const rows = [];
for (const m of members) {
  for (let day = 1; day <= 30; day++) {
    for (let i = questions(m.code, day); i > 0; i--) {
      const usage = { input_tokens: between(900, 959), output_tokens: between(100, 169) };
      rows.push({
        created_at: when(day),
        user_id: m.id,
        feature: "ask_the_club",
        model: "claude-haiku-5-5",
        ...usage,
        cost: costOf("claude-haiku-5-5", usage),
        duration_ms: between(1500, 3499),
        outcome: random() < 0.05 ? "fallback" : "answered",
      });
    }
  }
}

for (let i = 0; i < rows.length; i += 1000) {
  const { error } = await supabase.from("ai_usage").insert(rows.slice(i, i + 1000));
  if (error) throw error;
}
const total = rows.reduce((sum, r) => sum + r.cost, 0);
console.log(`${rows.length.toLocaleString("en-US")} rows, $${total.toFixed(2)}`);
