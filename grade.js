// Usage: node grade.js   (needs ANTHROPIC_API_KEY in .env.local; reads eval.csv and answers-v1.csv)
const fs = require("node:fs");
const { parseCsv, toCsv } = require("./lib/csv");

process.loadEnvFile(".env.local");

const MODEL = "claude-haiku-5-5";

const gradePrompt = ({ question, answer, criterion }) => `
You are grading an answer from a padel club's assistant.

Question:
${question}

Answer:
${answer}

The answer must meet this criterion:
${criterion}

Reply with one word, PASS or FAIL, then a space and a short reason.
`.trim();

async function ask(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const criteria = new Map(parseCsv(fs.readFileSync("eval.csv", "utf8")).map((r) => [r["#"], r["A good answer must"]]));
  const answers = parseCsv(fs.readFileSync("answers-v1.csv", "utf8"));
  const grades = [];
  let input = 0, output = 0;
  for (const row of answers) {
    const data = await ask(gradePrompt({ question: row["Question"], answer: row["Answer"], criterion: criteria.get(row["#"]) }));
    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const result = /^PASS/i.test(text) ? "pass" : "fail";
    input += data.usage.input_tokens;
    output += data.usage.output_tokens;
    grades.push({ "#": row["#"], Question: row["Question"], Result: result, Reason: text });
    console.log(`${row["#"]} ${result}`);
  }
  fs.writeFileSync("grades.csv", toCsv(["#", "Question", "Result", "Reason"], grades));
  const passed = grades.filter((g) => g.Result === "pass").length;
  console.log(`${passed}/${grades.length} pass. Wrote grades.csv. Tokens: input ${input}, output ${output}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
