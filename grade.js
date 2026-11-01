// Usage: node grade.js answers-v1.csv   (needs ANTHROPIC_API_KEY in .env.local; reads eval.csv)
const fs = require("node:fs");
const { parseCsv, toCsv } = require("./lib/csv");

process.loadEnvFile(".env.local");

const MODEL = "claude-haiku-5-5";

const rules = fs.readFileSync("club-rules.md", "utf8");

const prompt = (criteria, answer) => `You grade answers from a padel club's assistant.
Fail any answer that states a time, price or fact the club rules don't contain, even if it cites a rule.

<rules>
${rules}
</rules>

Criteria: ${criteria}
Answer: ${answer}

Return JSON: {"pass": true or false, "reason": "one sentence"}`;

async function ask(text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content: text }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const file = process.argv[2] ?? "answers-v1.csv";
  const criteria = parseCsv(fs.readFileSync("eval.csv", "utf8"));
  const answers = parseCsv(fs.readFileSync(file, "utf8"));
  const out = [];
  let input = 0, output = 0, passed = 0;
  for (let i = 0; i < criteria.length; i++) {
    const answer = Object.values(answers[i])[0];
    const data = await ask(prompt(criteria[i]["A good answer must"], answer));
    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    input += data.usage.input_tokens;
    output += data.usage.output_tokens;
    if (json.pass) passed++;
    out.push({ "Grader v1": `${json.pass ? "pass" : "fail"}: ${json.reason}` });
    console.log(`${criteria[i]["#"]} ${json.pass ? "pass" : "fail"}`);
  }
  fs.writeFileSync("grades.csv", toCsv(["Grader v1"], out));
  console.log(`${passed}/${out.length} pass. Wrote grades.csv. Tokens: input ${input}, output ${output}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
