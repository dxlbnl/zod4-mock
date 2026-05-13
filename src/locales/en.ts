import type { LocaleData } from "./types.js";
import { enFirstNamesMaleModel } from "../generators/data/markov/en-first-names-male.js";
import { enFirstNamesFemaleModel } from "../generators/data/markov/en-first-names-female.js";
import { enLastNamesModel } from "../generators/data/markov/en-last-names.js";
import { enNounsModel } from "../generators/data/markov/en-nouns.js";
import { enAdjectivesModel } from "../generators/data/markov/en-adjectives.js";

export const en: LocaleData = {
  id: "en",

  person: {
    firstNamesMaleModel:   enFirstNamesMaleModel,
    firstNamesFemaleModel: enFirstNamesFemaleModel,
    lastNamesModel:        enLastNamesModel,
    prefixes: {
      male:    ["Mr.", "Dr.", "Prof."],
      female:  ["Ms.", "Mrs.", "Dr.", "Prof."],
      neutral: ["Dr.", "Prof."],
    },
    suffixes: ["Jr.", "Sr.", "III", "IV", "Esq."],
    genders:  ["Male", "Female", "Non-binary", "Other"],
    formatFullName: (first, last) => `${first} ${last}`,
  },

  address: {
    cities: [
      "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
      "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
      "Fort Worth", "Columbus", "Charlotte", "Indianapolis", "San Francisco",
      "Seattle", "Denver", "Nashville", "Oklahoma City", "El Paso", "Washington",
      "Boston", "Las Vegas", "Portland", "Memphis", "Louisville", "Baltimore",
      "Milwaukee", "Albuquerque", "Tucson", "Fresno", "Sacramento", "Mesa",
    ],
    states: [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
      "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
      "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
      "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
      "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
      "New Hampshire", "New Jersey", "New Mexico", "New York",
      "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
      "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
      "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
      "Washington", "West Virginia", "Wisconsin", "Wyoming",
    ],
    countries: [
      "United States", "Canada", "United Kingdom", "Australia", "Germany",
      "France", "Japan", "South Korea", "Netherlands", "Switzerland",
      "Sweden", "Norway", "Denmark", "Finland", "Ireland",
      "New Zealand", "Austria", "Belgium", "Portugal", "Spain",
    ],
    streetFormats: [
      (num, name) => `${num} ${name} St`,
      (num, name) => `${num} ${name} Ave`,
      (num, name) => `${num} ${name} Blvd`,
      (num, name) => `${num} ${name} Dr`,
      (num, name) => `${num} ${name} Rd`,
    ],
    zipFormat: (prng) =>
      `${prng.int(10000, 99999)}`,
    phonePrefix: "+1",
    ibanPrefix:  "US",
    countryCode: "US",
  },

  commerce: {
    departments: [
      "Electronics", "Clothing", "Home", "Garden", "Toys", "Books", "Beauty",
      "Automotive", "Sports", "Health", "Shoes", "Jewelry", "Watches",
      "Music", "Movies", "Tools", "Pet Supplies", "Baby", "Office", "Grocery",
    ],
    materials: [
      "Wood", "Metal", "Plastic", "Glass", "Fabric", "Stone", "Leather",
      "Ceramic", "Cotton", "Wool", "Silk", "Rubber", "Bronze", "Copper",
      "Gold", "Silver", "Platinum", "Paper", "Cardboard", "Bamboo",
    ],
    productAdjectives: [
      "Small", "Ergonomic", "Rustic", "Intelligent", "Gorgeous",
      "Incredible", "Practical", "Handmade", "Generic", "Refined",
      "Unbranded", "Tasty", "Modern", "Classic", "Innovative",
      "Sustainable", "Recycled", "Stylish", "Minimalist", "Robust", "Luxe",
    ],
    currencyCode: "USD",
    formatPrice: (amount) => `$${amount.toFixed(2)}`,
  },

  company: {
    prefixes: [
      "Global", "Quantum", "Cyber", "Bio", "Eco", "Future", "Alpha", "Omega",
      "Nexus", "Aura", "Nova", "Apex", "Vanguard", "Pinnacle", "Summit",
    ],
    suffixes: [
      "Group", "LLC", "Inc", "Corp", "Solutions", "& Sons", "Partners",
      "Associates", "Holdings", "Consulting", "Tech", "Services",
      "Enterprises", "Logistics", "Digital",
    ],
    buzzAdjectives: [
      "Synergistic", "Robust", "Scalable", "Distributed", "Seamless",
      "Intuitive", "Enterprise", "Agile", "Dynamic", "Innovative",
      "Proactive", "Interactive", "Responsive", "Flexible", "Future-proof",
      "Data-driven", "Holistic", "Visionary", "Adaptive", "Integrated",
    ],
    buzzNouns: [
      "Solutions", "Infrastructure", "Paradigms", "Architectures", "Networks",
      "Platforms", "Ecosystems", "Strategies", "Synergies", "Initiatives",
      "Methodologies", "Channels", "Models", "Processes", "Applications",
      "Services", "Technologies", "Frameworks", "Interfaces", "Concepts",
    ],
    buzzVerbLemmas: [
      "streamline", "optimize", "leverage", "disrupt", "capitalize",
      "scale", "innovate", "transform", "implement", "maximize",
      "facilitate", "automate", "integrate", "synchronize", "accelerate",
      "visualize", "pioneer", "catalyze",
    ],
    formatBuzzPhrase: (verb, adj, noun) =>
      `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${adj.toLowerCase()} ${noun.toLowerCase()}`,
  },

  word: {
    nounModel:      enNounsModel,
    adjectiveModel: enAdjectivesModel,
    articles:      ["the", "a", "an"],
    prepositions:  ["in", "on", "at", "for", "with", "of", "to", "from", "by", "about"],
    conjunctions:  ["and", "or", "but", "because", "so", "yet"],
    pronouns:      ["he", "she", "they", "we", "I"],
    verbs:         ["is", "has", "goes", "makes", "says", "sees", "comes", "becomes"],
    verbsPlural:   ["are", "have", "go", "make", "say", "see", "come", "become"],
    adverbs:       ["quickly", "often", "always", "never", "now", "then", "here", "there"],
    interjections: ["hey", "oh", "yes", "no", "wow", "ah"],
  },

  finance: {
    bankCodes: ["BOFA", "CITI", "JPMC", "WELL", "HSBC", "USBA", "CHBU", "TDBA", "BANA", "FNMA"],
    formatIban: (prng, bankCode) =>
      `US${prng.int(10, 99)}${bankCode}${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`,
  },
};
