import type { LocaleData, LastNamePrefix } from "../../../src/locales/types.js";
import type { Prng } from "../../../src/types.js";
import { dutchMaleModel, dutchFemaleModel, dutchLastNamesModel } from "@zod4-mock/locale-names/groups/dutch";
import { arabicMaleModel, arabicFemaleModel }     from "@zod4-mock/locale-names/groups/arabic";
import { turkishMaleModel, turkishFemaleModel }   from "@zod4-mock/locale-names/groups/turkish";
import { frisianMaleModel, frisianFemaleModel }   from "@zod4-mock/locale-names/groups/frisian";
import { nlNounsModel } from "./models/nouns.js";
import { nlAdjectivesModel } from "./models/adjectives.js";

// Approximate name-origin distribution in the Dutch population:
//   ~68% Dutch-origin, ~12% Arabic, ~6% Turkish, ~2% Frisian, ~12% other (not modelled yet)
// Weights are proportional; only modelled origins are included.
export const nl: LocaleData = {
  id: "nl",

  person: {
    firstNamesMale: [
      { model: dutchMaleModel,    weight: 68 },
      { model: arabicMaleModel,   weight: 12 },
      { model: turkishMaleModel,  weight:  6 },
      { model: frisianMaleModel,  weight:  2 },
    ],
    firstNamesFemale: [
      { model: dutchFemaleModel,   weight: 68 },
      { model: arabicFemaleModel,  weight: 12 },
      { model: turkishFemaleModel, weight:  6 },
      { model: frisianFemaleModel, weight:  2 },
    ],
    lastNames: [{ model: dutchLastNamesModel, weight: 100 }],
    // Tussenvoegsels — ~35% of Dutch surnames carry one. Weights are relative to
    // each other; "no prefix" is implicitly given a weight of 100.
    lastNamePrefixes: [
      { prefix: "de",      weight: 15 },
      { prefix: "van",     weight: 12 },
      { prefix: "van der", weight:  5 },
      { prefix: "van den", weight:  4 },
      { prefix: "van de",  weight:  2 },
      { prefix: "ten",     weight:  1 },
      { prefix: "ter",     weight:  1 },
    ] satisfies readonly LastNamePrefix[],
    prefixes: {
      male:    ["Dhr.", "Dr.", "Prof."],
      female:  ["Mevr.", "Dr.", "Prof."],
      neutral: ["Dr.", "Prof."],
    },
    suffixes: ["Jr.", "Sr.", "III"],
    genders:  ["Man", "Vrouw", "Non-binair", "Anders"],
    // Lowercase the tussenvoegsel in full names: "Jan de Jong" not "Jan De Jong"
    formatFullName: (first, last) => `${first} ${last.charAt(0).toLowerCase() + last.slice(1)}`,
  },

  address: {
    cities: [
      "Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven", "Groningen",
      "Tilburg", "Almere", "Breda", "Nijmegen", "Enschede", "Apeldoorn",
      "Haarlem", "Arnhem", "Amersfoort", "Zaanstad", "Den Bosch", "Haarlemmermeer",
      "Zwolle", "Zoetermeer", "Leiden", "Leeuwarden", "Dordrecht", "Maastricht",
      "Ede", "Alphen aan den Rijn", "Westland", "Alkmaar", "Emmen", "Delft",
    ],
    states: [
      "Noord-Holland", "Zuid-Holland", "Utrecht", "Noord-Brabant", "Gelderland",
      "Overijssel", "Flevoland", "Groningen", "Friesland", "Drenthe", "Zeeland", "Limburg",
    ],
    countries: [
      "Nederland", "Duitsland", "België", "Frankrijk", "Verenigd Koninkrijk",
      "Oostenrijk", "Zwitserland", "Denemarken", "Zweden", "Noorwegen",
      "Spanje", "Italië", "Portugal", "Griekenland", "Ierland",
      "Finland", "Polen", "Tsjechië", "Hongarije", "Roemenië",
    ],
    streetFormats: [
      (num, name) => `${name}straat ${num}`,
      (num, name) => `${name}laan ${num}`,
      (num, name) => `${name}weg ${num}`,
    ],
    zipFormat: (prng: Prng) =>
      `${prng.int(1000, 9999)} ${String.fromCharCode(prng.int(65, 90))}${String.fromCharCode(prng.int(65, 90))}`,
    phonePrefix: "+31",
    ibanPrefix:  "NL",
    countryCode: "NL",
  },

  commerce: {
    departments: [
      "Elektronica", "Kleding", "Huis", "Tuin", "Speelgoed", "Boeken", "Beauty",
      "Auto", "Sport", "Gezondheid", "Schoenen", "Sieraden", "Horloges",
      "Muziek", "Films", "Gereedschap", "Dierenbenodigdheden", "Baby",
      "Kantoorartikelen", "Levensmiddelen",
    ],
    materials: [
      "Hout", "Metaal", "Plastic", "Glas", "Stof", "Steen", "Leer",
      "Keramiek", "Katoen", "Wol", "Zijde", "Rubber", "Brons", "Koper",
      "Goud", "Zilver", "Platinum", "Papier", "Karton", "Bamboe",
    ],
    productAdjectives: [
      "Klein", "Ergonomisch", "Rustiek", "Intelligent", "Prachtig",
      "Ongelooflijk", "Praktisch", "Handgemaakt", "Generiek", "Verfijnd",
      "Merkloos", "Lekker", "Modern", "Klassiek", "Innovatief", "Duurzaam",
      "Gerecycled", "Stijlvol", "Minimalistisch", "Robuust", "Luxe",
    ],
    currencyCode: "EUR",
    formatPrice: (amount) => `€${amount.toFixed(2)}`,
  },

  company: {
    prefixes: [
      "Globaal", "Quantum", "Cyber", "Bio", "Eco", "Toekomst", "Alpha", "Omega",
      "Nexus", "Aura", "Nova", "Apex", "Vanguard", "Pinnacle", "Summit",
    ],
    suffixes: [
      "Groep", "BV", "NV", "VOF", "Oplossingen", "en Zonen", "Partners",
      "Associates", "Holdings", "Consultancy", "Tech", "Services",
      "Enterprises", "Logistics", "Digital",
    ],
    buzzAdjectives: [
      "Synergetisch", "Robuust", "Schaalbaar", "Gedistribueerd", "Naadloos",
      "Intuïtief", "Zakelijk", "Agile", "Dynamisch", "Innovatief",
      "Proactief", "Interactief", "Responsief", "Flexibel", "Toekomstbestendig",
      "Datagedreven", "Holistisch", "Visionair", "Adaptief", "Geïntegreerd",
    ],
    buzzNouns: [
      "Oplossingen", "Infrastructuur", "Paradigma's", "Architecturen", "Netwerken",
      "Platformen", "Ecosystemen", "Strategieën", "Synergieën", "Initiatieven",
      "Methodologieën", "Kanalen", "Modellen", "Processen", "Applicaties",
      "Diensten", "Technologieën", "Frameworks", "Interfaces", "Concepten",
    ],
    buzzVerbLemmas: [
      "stroomlijnen", "optimaliseren", "versterken", "ontwrichten", "benutten",
      "verzilveren", "schalen", "innoveren", "transformeren", "implementeren",
      "maximaliseren", "faciliteren", "automatiseren", "integreren", "synchroniseren",
      "versnellen", "visualiseren", "pionieren", "katalyseren",
    ],
    formatBuzzPhrase: (verb, adj, noun) => `${verb} ${adj.toLowerCase()} ${noun.toLowerCase()}`,
  },

  word: {
    nounModel:      nlNounsModel,
    adjectiveModel: nlAdjectivesModel,
    articles:      ["de", "het", "een"],
    prepositions:  ["in", "op", "van", "voor", "met", "naar", "door", "uit"],
    conjunctions:  ["en", "of", "maar", "want", "omdat"],
    pronouns:      ["hij", "zij", "wij", "ik"],
    verbs:         ["is", "heeft", "gaat", "doet", "maakt", "zegt", "ziet", "komt", "wordt"],
    verbsPlural:   ["zijn", "hebben", "gaan", "doen", "maken", "zeggen", "zien", "komen", "worden"],
    adverbs:       ["snel", "vaak", "altijd", "nooit", "nu", "dan", "hier", "daar"],
    interjections: ["hé", "oh", "ja", "nee", "wouw", "ah"],
  },

  finance: {
    bankCodes: ["ABNA", "INGB", "RABO", "SNSB", "TRIO", "KNAB", "BUNQ", "ASNB", "AEGO", "NNBA"],
    formatIban: (prng: Prng, bankCode: string) =>
      `NL${prng.int(10, 99)}${bankCode}${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`,
  },
};
