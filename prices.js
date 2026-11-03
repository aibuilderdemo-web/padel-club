// prices.js. Dollars per million tokens.
// Copied from claude.com/pricing on 2026-11-03.
export const PRICES = {
  "claude-haiku-5-5": { input: 0.10, output: 0.50 },
  "claude-opus-5-5":  { input: 4.00, output: 20.00 },
};

export function costOf(model, usage) {
  const p = PRICES[model];
  return (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1_000_000;
}
