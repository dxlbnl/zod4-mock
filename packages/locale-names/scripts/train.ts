/**
 * Train all cultural group Markov models from data/training/.
 * Run `pnpm fetch-data` first to populate the training data.
 *
 * Usage: pnpm --filter @zod4-mock/locale-names train
 */

import { trainMarkov } from "../../../scripts/train-markov.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data/training");
const srcDir = join(__dirname, "../src/groups");

// Parameters follow wiki/research/better-gen/markov-training-pipeline.md recommendations
const models = [
  // Dutch — Germanic Dutch, high-frequency core (> 100, minus classified origins)
  { group: "dutch", file: "male", name: "dutchMaleModel", order: 3, minWordLen: 3, maxWordLen: 10 },
  {
    group: "dutch",
    file: "female",
    name: "dutchFemaleModel",
    order: 3,
    minWordLen: 3,
    maxWordLen: 10,
  },
  {
    group: "dutch",
    file: "last-names",
    name: "dutchLastNamesModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 12,
  },

  // Arabic — extracted from Dutch registry (Dutch transliteration of Arabic names)
  {
    group: "arabic",
    file: "male",
    name: "arabicMaleModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 12,
  },
  {
    group: "arabic",
    file: "female",
    name: "arabicFemaleModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 12,
  },

  // Turkish — extracted from Dutch registry
  {
    group: "turkish",
    file: "male",
    name: "turkishMaleModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 10,
  },
  {
    group: "turkish",
    file: "female",
    name: "turkishFemaleModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 10,
  },

  // Frisian — regional Frisian names, extracted from Dutch registry
  {
    group: "frisian",
    file: "male",
    name: "frisianMaleModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 10,
  },
  {
    group: "frisian",
    file: "female",
    name: "frisianFemaleModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 10,
  },

  // English — Anglo-Saxon/American, arineng/arincli sourced
  {
    group: "english",
    file: "male",
    name: "englishMaleModel",
    order: 3,
    minWordLen: 3,
    maxWordLen: 10,
  },
  {
    group: "english",
    file: "female",
    name: "englishFemaleModel",
    order: 3,
    minWordLen: 3,
    maxWordLen: 10,
  },
  {
    group: "english",
    file: "last-names",
    name: "englishLastNamesModel",
    order: 2,
    minWordLen: 3,
    maxWordLen: 12,
  },
] as const;

for (const m of models) {
  await trainMarkov({
    input: join(dataDir, m.group, `${m.file}.txt`),
    output: join(srcDir, m.group, `${m.file}.ts`),
    name: m.name,
    order: m.order,
    minWordLen: m.minWordLen,
    maxWordLen: m.maxWordLen,
    typeImport: "zod4-mock",
  });
}
