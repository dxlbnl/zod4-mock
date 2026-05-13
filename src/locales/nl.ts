import type { LocaleData, MarkovModel } from "./types.js";

// Placeholder model — replaced by trained models in Commit 3.
const STUB: MarkovModel = { order: 2, prior: 0.01, chars: "abcdefghijklmnopqrstuvwxyz$", table: {} };

export const nl: LocaleData = {
  id: "nl",

  person: {
    firstNamesMaleModel:   STUB,
    firstNamesFemaleModel: STUB,
    lastNamesModel:        STUB,
    prefixes: {
      male:    ["Dhr.", "Dr.", "Prof."],
      female:  ["Mevr.", "Dr.", "Prof."],
      neutral: ["Dr.", "Prof."],
    },
    suffixes: ["Jr.", "Sr.", "III"],
    genders:  ["Man", "Vrouw", "Non-binair", "Anders"],
    formatFullName: (first, last) => `${first} ${last}`,
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
    zipFormat: (prng) =>
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
    nounModel:      STUB,
    adjectiveModel: STUB,
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
    formatIban: (prng, bankCode) =>
      `NL${prng.int(10, 99)}${bankCode}${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`,
  },
};
