// Usage: node run_eval.js   (dev server running on :3000; needs .env.local and .env.test)
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");
const { parseCsv, toCsv } = require("./lib/csv");

process.loadEnvFile(".env.local");
process.loadEnvFile(".env.test");

async function main() {
  const password = process.env.TEST_PASSWORD;
  if (!password) throw new Error("TEST_PASSWORD is not set in .env.test");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "member@test.com",
    password,
  });
  if (error) throw new Error(`Login failed: ${error.message}`);
  const token = data.session.access_token;

  const rows = parseCsv(fs.readFileSync("eval.csv", "utf8"));
  const out = [];
  let input = 0, output = 0;
  for (const row of rows) {
    const res = await fetch("http://localhost:3000/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: row["Question"] }),
    });
    if (!res.ok) throw new Error(`Row ${row["#"]}: ${res.status} ${(await res.text()).slice(0, 500)}`);
    const json = await res.json();
    input += json.usage.input_tokens;
    output += json.usage.output_tokens;
    out.push({ "#": row["#"], Question: row["Question"], Answer: json.answer });
    console.log(`${row["#"]} done`);
  }
  fs.writeFileSync("answers-v1.csv", toCsv(["#", "Question", "Answer"], out));
  console.log(`Wrote answers-v1.csv. Tokens: input ${input}, output ${output}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
