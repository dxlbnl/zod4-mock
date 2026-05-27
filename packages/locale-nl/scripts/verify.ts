/**
 * Print sample words from all Dutch Markov models for visual inspection.
 *
 * Usage: pnpm --filter @zod4-mock/locale-nl verify
 */

import { verifyMarkov } from "../../../scripts/verify-markov.js";
import {
  nlFirstNamesMaleModel,
  nlFirstNamesFemaleModel,
  nlLastNamesModel,
  nlNounsModel,
  nlAdjectivesModel,
} from "../src/models/index.js";

const models = [
  { model: nlFirstNamesMaleModel,   name: "nlFirstNamesMaleModel" },
  { model: nlFirstNamesFemaleModel, name: "nlFirstNamesFemaleModel" },
  { model: nlLastNamesModel,        name: "nlLastNamesModel" },
  { model: nlNounsModel,            name: "nlNounsModel" },
  { model: nlAdjectivesModel,       name: "nlAdjectivesModel" },
];

for (const { model, name } of models) {
  console.log();
  verifyMarkov({ model, name });
}
