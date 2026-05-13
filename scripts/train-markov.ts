/**
 * @file scripts/train-markov.ts
 *
 * Train an Order-N Markov character model from a wordlist and emit a TypeScript
 * module exporting the trained model.
 *
 * Usage:
 *   npx tsx scripts/train-markov.ts \
 *     --input  data/training/en/first-names-male.txt \
 *     --output src/generators/data/markov/en-first-names-male.ts \
 *     --name   enFirstNamesMaleModel \
 *     --order  2 \
 *     --prior  0.01
 *
 * The input file must contain one word per line (blank lines and # comments ignored).
 * Words are lowercased and deduplicated before training.
 *
 * Algorithm:
 *   1. For every word, slide a window of `order` chars over its characters,
 *      adding a terminal "$" at the end.
 *   2. Count successor characters for each n-gram state.
 *   3. Apply Dirichlet smoothing: weight = count + prior.
 *   4. Normalise each row into a CDF (cumulative distribution function).
 *   5. Emit a .ts file containing the MarkovModel.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  input: string;
  output: string;
  name: string;
  order: number;
  prior: number;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const input  = get("--input");
  const output = get("--output");
  const name   = get("--name");
  const order  = Number(get("--order")  ?? "2");
  const prior  = Number(get("--prior")  ?? "0.01");

  if (!input || !output || !name) {
    console.error(
      "Usage: npx tsx scripts/train-markov.ts " +
      "--input <file> --output <file> --name <identifier> [--order N] [--prior P]",
    );
    process.exit(1);
  }

  return { input, output, name, order, prior };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

function train(
  words: string[],
  order: number,
  prior: number,
): { chars: string; table: Record<string, number[]> } {
  const counts: Record<string, Record<string, number>> = {};

  const recordNgram = (state: string, next: string): void => {
    const row = (counts[state] ??= {});
    row[next] = (row[next] ?? 0) + 1;
  };

  // Build raw counts
  const alphabet = new Set<string>();
  for (const word of words) {
    const padded = word.toLowerCase();
    for (let i = 0; i < padded.length; i++) {
      alphabet.add(padded[i]!);
    }
    // Slide window over word + terminal
    for (let i = 0; i <= padded.length; i++) {
      const state = padded.slice(Math.max(0, i - order), i);
      const next  = i < padded.length ? padded[i]! : "$";
      recordNgram(state, next);
    }
  }

  // Build sorted alphabet including sentinel
  const chars = [...alphabet].sort().join("") + "$";

  // Convert counts → CDF rows with Dirichlet smoothing
  const table: Record<string, number[]> = {};
  for (const [state, row] of Object.entries(counts)) {
    const weights: number[] = chars.split("").map((ch) => (row[ch] ?? 0) + prior);
    const total = weights.reduce((a, b) => a + b, 0);
    // Build CDF
    let cumulative = 0;
    const cdf = weights.map((w) => {
      cumulative += w / total;
      return cumulative;
    });
    // Clamp last entry to exactly 1 (floating-point safety)
    cdf[cdf.length - 1] = 1;
    table[state] = cdf;
  }

  return { chars, table };
}

// ---------------------------------------------------------------------------
// Emit TypeScript source
// ---------------------------------------------------------------------------

function emit(
  name: string,
  order: number,
  prior: number,
  chars: string,
  table: Record<string, number[]>,
): string {
  const tableEntries = Object.entries(table)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, cdf]) => {
      const cdfStr = cdf.map((v) => v.toFixed(6)).join(",");
      return `  ${JSON.stringify(key)}: [${cdfStr}]`;
    })
    .join(",\n");

  return `import type { MarkovModel } from "../../../locales/types.js";

export const ${name}: MarkovModel = {
  order: ${order},
  prior: ${prior},
  chars: ${JSON.stringify(chars)},
  table: {
${tableEntries},
  },
};
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { input, output, name, order, prior } = parseArgs();

const raw = readFileSync(input, "utf8");
const words = raw
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => l.toLowerCase())
  .filter((w) => /^[a-z]+$/.test(w));

const unique = [...new Set(words)];
console.log(`Training on ${unique.length} unique words (order=${order}, prior=${prior}) …`);

const { chars, table } = train(unique, order, prior);
const src = emit(name, order, prior, chars, table);

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, src, "utf8");
console.log(`Written to ${output}  (${Object.keys(table).length} states, ${chars.length} chars)`);
