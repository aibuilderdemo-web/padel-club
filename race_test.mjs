// Usage: node race_test.mjs   (dev server running on :3000; needs .env.local and migration 0012 applied)
// Logs in as test member m_09, sets today's count to 18, sends 5 questions at the same moment.
// Expected: 2 answers (counts 19 and 20), 3 refusals (21, 22, 23), final count 23.
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const check = (error, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

// The member m_09 and their email.
const { data: member, error: memberError } = await admin.from("members").select("id").eq("code", "m_09").single();
check(memberError, "find m_09");
const { data: user, error: userError } = await admin.auth.admin.getUserById(member.id);
check(userError, "get m_09's user");

// Log in without a password: a one-time link for that user, exchanged for a session.
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: user.user.email,
});
check(linkError, "generate login link");
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data: session, error: loginError } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: link.properties.hashed_token,
});
check(loginError, "log in as m_09");
const token = session.session.access_token;

// Today's count (club day, Europe/Rome) = 18.
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
const { error: setError } = await admin.from("ai_daily_count").upsert({ user_id: member.id, day, n: 18 });
check(setError, "set the count to 18");
console.log(`m_09: count for ${day} set to 18. Sending 5 questions at once...`);

const ask = async (i) => {
  const res = await fetch("http://localhost:3000/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: `Question ${i + 1}: can I cancel a booking on the same day?` }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text };
  }
  const first = (body.answer ?? body.error ?? "").split("\n")[0];
  return `${i + 1}. [${res.status}] ${first}`;
};

const results = await Promise.all([0, 1, 2, 3, 4].map(ask));
results.forEach((line) => console.log(line));

const { data: after, error: afterError } = await admin
  .from("ai_daily_count")
  .select("n")
  .eq("user_id", member.id)
  .eq("day", day)
  .single();
check(afterError, "read the final count");
console.log(`Final count: ${after.n} (expected 23)`);
