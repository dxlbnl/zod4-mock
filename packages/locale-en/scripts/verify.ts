/**
 * Print sample words from all English Markov models for visual inspection.
 *
 * Usage: pnpm --filter @zod4-mock/locale-en verify
 */

import { verifyMarkov } from "../../../scripts/verify-markov.js";
import {
  enFirstNamesMaleModel,
  enFirstNamesFemaleModel,
  enLastNamesModel,
  enNounsModel,
  enAdjectivesModel,
} from "../src/models/index.js";

const models = [
  { model: enFirstNamesMaleModel,   name: "enFirstNamesMaleModel" },
  { model: enFirstNamesFemaleModel, name: "enFirstNamesFemaleModel" },
  { model: enLastNamesModel,        name: "enLastNamesModel" },
  { model: enNounsModel,            name: "enNounsModel" },
  { model: enAdjectivesModel,       name: "enAdjectivesModel" },
];

for (const { model, name } of models) {
  console.log();
  verifyMarkov({ model, name });
}
