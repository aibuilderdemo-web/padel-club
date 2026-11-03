import { PRICES } from "./prices.js";

const perQ = (m) => (930 * PRICES[m].input + 130 * PRICES[m].output) / 1_000_000;
const row = (label, n) =>
  console.log(label.padEnd(29),
    "Haiku $", (n * perQ("claude-haiku-5-5")).toFixed(2).padStart(7),
    "  Opus $", (n * perQ("claude-opus-5-5")).toFixed(2).padStart(7));

row("typical member, 40 a month", 40);
row("capped at 20 a day", 20 * 30);
row("the script, 2,000 a day", 2000 * 30);
