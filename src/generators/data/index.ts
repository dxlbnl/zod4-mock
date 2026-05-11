import * as commerce from "./commerce.js";
import * as company from "./company.js";
import * as date from "./date.js";
import * as finance from "./finance.js";
import * as internetRaw from "./internet.js";
import * as locationRaw from "./location.js";
import * as person from "./person.js";
import * as phone from "./phone.js";
import * as vehicle from "./vehicle.js";
import * as word from "./word.js";
import * as string from "./string.js";

export { commerce, company, date, finance, person, phone, vehicle, word, string };

export const internet = {
  ...internetRaw,
  domain: internetRaw.domainName,
  DOMAINS: internetRaw.DOMAINS,
  EMOJIS: internetRaw.EMOJIS,
};

export const location = {
  ...locationRaw,
  postalCode: locationRaw.zipCode,
};

export const lorem = {
  ...word,
  word: word.noun,
  TECH_WORDS: word.TECH_WORDS,
};
