// Usage: node run_eval.js eval.csv v1   (dev server running on :3000; needs .env.local and .env.test)
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");
const { parseCsv, toCsv } = require("./lib/csv");

process.loadEnvFile(".env.local");
process.loadEnvFile(".env.test");

async function main() {
  const [file = "eval.csv", version = "v1"] = process.argv.slice(2);
  const password = process.env.MEMBER_PASSWORD;
  if (!password) throw new Error("MEMBER_PASSWORD is not set in .env.test");
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

  const rows = parseCsv(fs.readFileSync(file, "utf8"));
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
    out.push({ [`Answer ${version}`]: json.answer });
    console.log(`${row["#"]} done`);
  }
  fs.writeFileSync(`answers-${version}.csv`, toCsv([`Answer ${version}`], out));
  console.log(`Wrote answers-${version}.csv. Tokens: input ${input}, output ${output}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
