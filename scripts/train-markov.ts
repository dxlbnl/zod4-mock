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
 * Or import programmatically:
 *   import { trainMarkov } from './train-markov.js';
 *   await trainMarkov({ input, output, name });
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrainOptions {
  input: string;
  output: string;
  name: string;
  order?: number;
  prior?: number;
  /** Import path for the MarkovModel type in emitted files. Default: "zod4-mock" */
  typeImport?: string;
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

  const alphabet = new Set<string>();
  for (const word of words) {
    const padded = word.toLowerCase();
    for (let i = 0; i < padded.length; i++) {
      alphabet.add(padded[i]!);
    }
    for (let i = 0; i <= padded.length; i++) {
      const state = padded.slice(Math.max(0, i - order), i);
      const next  = i < padded.length ? padded[i]! : "$";
      recordNgram(state, next);
    }
  }

  const chars = [...alphabet].sort().join("") + "$";

  const table: Record<string, number[]> = {};
  for (const [state, row] of Object.entries(counts)) {
    const weights: number[] = chars.split("").map((ch) => (row[ch] ?? 0) + prior);
    const total = weights.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    const cdf = weights.map((w) => {
      cumulative += w / total;
      return cumulative;
    });
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
  typeImport: string,
): string {
  const tableEntries = Object.entries(table)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, cdf]) => {
      const cdfStr = cdf.map((v) => v.toFixed(6)).join(",");
      return `  ${JSON.stringify(key)}: [${cdfStr}]`;
    })
    .join(",\n");

  return `import type { MarkovModel } from "${typeImport}";

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
// Programmatic API
// ---------------------------------------------------------------------------

export async function trainMarkov(opts: TrainOptions): Promise<void> {
  const { input, output, name, order = 2, prior = 0.01, typeImport = "zod4-mock" } = opts;

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
  const src = emit(name, order, prior, chars, table, typeImport);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, src, "utf8");
  console.log(`Written to ${output}  (${Object.keys(table).length} states, ${chars.length} chars)`);
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
  const typeImport = get("--type-import") ?? "zod4-mock";

  if (!input || !output || !name) {
    console.error(
      "Usage: npx tsx scripts/train-markov.ts " +
      "--input <file> --output <file> --name <identifier> [--order N] [--prior P] [--type-import <pkg>]",
    );
    process.exit(1);
  }

  await trainMarkov({ input, output, name, order, prior, typeImport });
}
