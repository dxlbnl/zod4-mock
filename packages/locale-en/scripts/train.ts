/**
 * Generate all English Markov model files from data/training/*.txt.
 * Run `pnpm fetch-data` first to populate the training data.
 *
 * Usage: pnpm --filter @zod4-mock/locale-en train
 */

import { trainMarkov } from "../../../scripts/train-markov.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir   = join(__dirname, "../data/training");
const modelsDir = join(__dirname, "../src/models");

const models = [
  { input: "first-names-male.txt",   output: "first-names-male.ts",   name: "enFirstNamesMaleModel" },
  { input: "first-names-female.txt", output: "first-names-female.ts", name: "enFirstNamesFemaleModel" },
  { input: "last-names.txt",         output: "last-names.ts",         name: "enLastNamesModel" },
  { input: "nouns.txt",              output: "nouns.ts",              name: "enNounsModel" },
  { input: "adjectives.txt",         output: "adjectives.ts",         name: "enAdjectivesModel" },
] as const;

for (const m of models) {
  await trainMarkov({
    input:      join(dataDir,   m.input),
    output:     join(modelsDir, m.output),
    name:       m.name,
    typeImport: "zod4-mock",
  });
}
