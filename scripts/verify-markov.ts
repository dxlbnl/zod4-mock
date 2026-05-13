/**
 * @file scripts/verify-markov.ts
 *
 * Import a trained model file and print sample words for human inspection.
 *
 * Usage:
 *   npx tsx scripts/verify-markov.ts \
 *     --model src/generators/data/markov/en-first-names-male.ts \
 *     --count 20 \
 *     --seed  42
 */

import { createPrng } from "../src/prng.js";
import { sampleMarkov } from "../src/generators/data/markov/sample.js";
import type { MarkovModel } from "../src/locales/types.js";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { model: string; count: number; seed: number } {
  const args = process.argv.slice(2);
  const get  = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const model = get("--model");
  const count = Number(get("--count") ?? "20");
  const seed  = Number(get("--seed")  ?? "42");

  if (!model) {
    console.error(
      "Usage: npx tsx scripts/verify-markov.ts --model <file> [--count N] [--seed S]",
    );
    process.exit(1);
  }

  return { model: model!, count, seed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { model: modelPath, count, seed } = parseArgs();

// Dynamic import — tsx handles TypeScript resolution
const imported: Record<string, unknown> = await import(`../${modelPath}`);
const modelKey = Object.keys(imported)[0]!;
const model = imported[modelKey] as MarkovModel;

if (!model?.table) {
  console.error(`Could not find a MarkovModel export in ${modelPath}`);
  process.exit(1);
}

console.log(`Model: ${modelKey} (order=${model.order}, states=${Object.keys(model.table).length}, chars="${model.chars}")`);
console.log(`Sampling ${count} words with seed=${seed}:\n`);

const prng = createPrng(seed);
const results: string[] = [];
for (let i = 0; i < count; i++) {
  results.push(sampleMarkov(prng, model));
}
console.log(results.join("  "));
