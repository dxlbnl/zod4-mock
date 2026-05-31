/**
 * Sample from all trained models and print results for human inspection.
 *
 * Usage: pnpm --filter @zod4-mock/locale-names verify
 */

import { verifyMarkov } from "../../../scripts/verify-markov.js";
import { dutchMaleModel } from "../src/groups/dutch/male.js";
import { dutchFemaleModel } from "../src/groups/dutch/female.js";
import { dutchLastNamesModel } from "../src/groups/dutch/last-names.js";
import { arabicMaleModel } from "../src/groups/arabic/male.js";
import { arabicFemaleModel } from "../src/groups/arabic/female.js";
import { turkishMaleModel } from "../src/groups/turkish/male.js";
import { turkishFemaleModel } from "../src/groups/turkish/female.js";
import { frisianMaleModel } from "../src/groups/frisian/male.js";
import { frisianFemaleModel } from "../src/groups/frisian/female.js";
import { englishMaleModel } from "../src/groups/english/male.js";
import { englishFemaleModel } from "../src/groups/english/female.js";
import { englishLastNamesModel } from "../src/groups/english/last-names.js";

const models = [
  { model: dutchMaleModel, name: "dutchMaleModel" },
  { model: dutchFemaleModel, name: "dutchFemaleModel" },
  { model: dutchLastNamesModel, name: "dutchLastNamesModel" },
  { model: arabicMaleModel, name: "arabicMaleModel" },
  { model: arabicFemaleModel, name: "arabicFemaleModel" },
  { model: turkishMaleModel, name: "turkishMaleModel" },
  { model: turkishFemaleModel, name: "turkishFemaleModel" },
  { model: frisianMaleModel, name: "frisianMaleModel" },
  { model: frisianFemaleModel, name: "frisianFemaleModel" },
  { model: englishMaleModel, name: "englishMaleModel" },
  { model: englishFemaleModel, name: "englishFemaleModel" },
  { model: englishLastNamesModel, name: "englishLastNamesModel" },
];

for (const { model, name } of models) {
  console.log();
  verifyMarkov({ model, name, count: 20 });
}
