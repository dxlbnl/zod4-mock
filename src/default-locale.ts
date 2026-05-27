import type { LocaleData, Prng } from "@zod4-mock/locale-core";

/**
 * Minimal English locale used when no `locale` is passed to `createWorld()`.
 * Deliberately small and Markov-free — names and words come from short curated
 * arrays. For realistic, Markov-generated data import a full locale package
 * (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`).
 */

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const defaultLocale: LocaleData = {
  id: "default",

  person: {
    simpleFirstNamesMale: [
      "James", "John", "Michael", "David", "Robert", "William", "Thomas", "Daniel",
      "Joseph", "Charles", "Andrew", "Paul", "Mark", "Henry", "George", "Edward",
    ],
    simpleFirstNamesFemale: [
      "Mary", "Linda", "Sarah", "Emma", "Olivia", "Sophia", "Anna", "Laura",
      "Emily", "Grace", "Alice", "Julia", "Hannah", "Rachel", "Claire", "Rose",
    ],
    simpleLastNames: [
      "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
      "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris",
    ],
    prefixes: {
      male:    ["Mr.", "Dr."],
      female:  ["Ms.", "Mrs.", "Dr."],
      neutral: ["Dr."],
    },
    suffixes: ["Jr.", "Sr.", "III"],
    genders: ["Male", "Female", "Non-binary", "Other"],
    jobTitles: ["Developer", "Engineer", "Manager", "Designer", "Analyst", "Consultant", "Director", "Specialist"],
    jobAreas: ["Engineering", "Product", "Design", "Operations", "Marketing", "Sales", "Finance", "Support"],
    jobTypes: ["Lead", "Senior", "Junior", "Head", "Assistant", "Intern"],
    jobDescriptors: ["Innovative", "Strategic", "Global", "Dynamic"],
    formatFullName: (first, last) => `${first} ${last}`,
    formatBio: (prng, { jobTitle, jobArea, jobType }) => {
      const t  = jobTitle.toLowerCase();
      const a  = jobArea.toLowerCase();
      const ty = jobType ? jobType.toLowerCase() + " " : "";
      const templates = [
        () => cap(`${ty}${t} specializing in ${a}.`),
        () => `Working as ${ty}${t} in ${a}.`,
        () => cap(`${ty}${t} with a passion for ${a}.`),
      ] as const;
      return templates[prng.int(0, templates.length - 1)]!();
    },
  },

  address: {
    cities: [
      "Springfield", "Riverside", "Franklin", "Greenville", "Bristol", "Clinton",
      "Fairview", "Salem", "Madison", "Georgetown", "Arlington", "Ashland",
    ],
    states: [
      "California", "Texas", "Florida", "New York", "Pennsylvania", "Illinois",
      "Ohio", "Georgia", "Michigan", "Washington", "Arizona", "Colorado",
    ],
    countries: [
      "United States", "Canada", "United Kingdom", "Australia", "Germany",
      "France", "Japan", "Netherlands", "Sweden", "Ireland",
    ],
    countryCodes: ["US", "CA", "GB", "AU", "DE", "FR", "JP", "NL", "SE", "IE"],
    continents: ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"],
    languages: ["English", "Spanish", "French", "German", "Japanese", "Dutch"],
    streetNames: [
      "Main", "Oak", "Pine", "Maple", "Cedar", "Elm", "First", "Second",
      "Park", "Lake", "Hill", "Washington", "Lincoln", "Church", "Market", "Spring",
    ],
    streetSuffixes: ["St", "Ave", "Blvd", "Dr", "Rd", "Ln", "Way", "Ct"],
    cityPrefixes: ["New ", "Old ", "North ", "South ", "East ", "West "],
    cityCores: ["ville", "town", "burg", "field", "ford", "port", "wood", "haven"],
    buildingNumberSuffixes: ["", "", "", "A", "B", "C"],
    timeZones: [
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "Europe/London", "Europe/Paris", "Asia/Tokyo", "UTC",
    ],
    directions: ["North", "East", "South", "West", "Northeast", "Southeast", "Southwest", "Northwest"],
    cardinalDirections: ["North", "East", "South", "West"],
    ordinalDirections: ["Northeast", "Southeast", "Southwest", "Northwest"],
    streetFormats: [
      (num, name) => `${num} ${name} St`,
      (num, name) => `${num} ${name} Ave`,
      (num, name) => `${num} ${name} Rd`,
    ],
    zipFormat: (prng: Prng) => `${prng.int(10000, 99999)}`,
    secondaryAddressFormat: (n) => `Apt ${n}`,
    phonePrefix: "+1",
    ibanPrefix:  "US",
    countryCode: "US",
  },

  commerce: {
    departments: [
      "Electronics", "Clothing", "Home", "Garden", "Toys", "Books", "Beauty",
      "Sports", "Health", "Tools", "Office", "Grocery",
    ],
    materials: [
      "Wood", "Metal", "Plastic", "Glass", "Cotton", "Leather", "Ceramic",
      "Steel", "Rubber", "Paper", "Bamboo", "Stone",
    ],
    productAdjectives: [
      "Small", "Ergonomic", "Rustic", "Intelligent", "Practical", "Handmade",
      "Generic", "Modern", "Classic", "Sleek", "Durable", "Compact",
    ],
    currencyCode: "USD",
    formatPrice: (amount) => `$${amount.toFixed(2)}`,
    formatProductName: (adjective, material, noun) =>
      `${adjective} ${material.toLowerCase()} ${noun}`,
    formatProductDescription: ({ productName, adjective, noun, department }) =>
      `${productName}: ${adjective.toLowerCase()} ${noun} for your ${department.toLowerCase()} needs.`,
  },

  company: {
    prefixes: ["Global", "Quantum", "Cyber", "Eco", "Future", "Alpha", "Nova", "Apex"],
    suffixes: ["Group", "LLC", "Inc", "Corp", "Solutions", "Partners", "Tech", "Services"],
    buzzAdjectives: [
      "Synergistic", "Robust", "Scalable", "Seamless", "Intuitive", "Agile",
      "Dynamic", "Innovative", "Proactive", "Holistic", "Adaptive", "Integrated",
    ],
    buzzNouns: [
      "Solutions", "Infrastructure", "Networks", "Platforms", "Ecosystems",
      "Strategies", "Initiatives", "Channels", "Models", "Processes", "Services", "Frameworks",
    ],
    buzzVerbLemmas: [
      "streamline", "optimize", "leverage", "scale", "innovate", "transform",
      "implement", "maximize", "facilitate", "automate", "integrate", "accelerate",
    ],
    catchPhraseAdjectives: [
      "Customer-focused", "Layered", "Upgradable", "Compatible", "Versatile",
      "Reliable", "Secure", "Accessible", "Exclusive", "Superior", "Essential", "Robust",
    ],
    catchPhraseDescriptors: [
      "optimal", "modular", "monitored", "streamlined", "automated", "personalized",
      "transparent", "flexible", "scalable", "integrated", "decentralized", "virtual",
    ],
    catchPhraseNouns: [
      "capacity", "interface", "projection", "success", "efficiency", "quality",
      "security", "growth", "performance", "engagement", "productivity", "flexibility",
    ],
    formatBuzzPhrase: (verb, adj, noun) =>
      `${cap(verb)} ${adj.toLowerCase()} ${noun.toLowerCase()}`,
  },

  word: {
    nouns: [
      "thing", "object", "item", "element", "unit", "piece", "part", "section",
      "system", "process", "value", "result", "matter", "concept", "subject", "factor",
    ],
    adjectives: [
      "good", "new", "first", "last", "long", "great", "little", "own",
      "other", "old", "right", "big", "high", "different", "small", "large",
    ],
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
    bankCodes: ["BOFA", "CITI", "JPMC", "WELL", "HSBC", "USBA"],
    bicLocations: ["33", "44", "55", "66"],
    currencies: [
      { code: "USD", name: "US Dollar",      symbol: "$", numeric: "840" },
      { code: "EUR", name: "Euro",           symbol: "€", numeric: "978" },
      { code: "GBP", name: "British Pound",  symbol: "£", numeric: "826" },
      { code: "JPY", name: "Japanese Yen",   symbol: "¥", numeric: "392" },
    ],
    accountNames: ["Savings", "Checking", "Business", "Credit Card", "Investment", "Joint Account"],
    transactionTypes: ["deposit", "withdrawal", "payment", "invoice", "refund", "transfer"],
    transactionDescriptions: [
      "Grocery store", "Monthly rent", "Salary", "Online shopping",
      "Gas station", "Restaurant bill", "Subscription", "Utility bill",
    ],
    formatIban: (prng: Prng, bankCode: string) =>
      `US${prng.int(10, 99)}${bankCode}${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`,
  },

  date: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    timeZones: ["UTC", "America/New_York", "Europe/London", "Europe/Paris", "Asia/Tokyo"],
  },

  color: {
    names: [
      "red", "blue", "green", "yellow", "orange", "purple",
      "pink", "black", "white", "gray", "brown", "cyan",
    ],
  },

  phone: {
    mobilePrefix: "+1",
    landlinePrefixes: ["212", "213", "312", "415", "617", "713"],
    formatMobile: (prng: Prng) => {
      const num = Array.from({ length: 10 }, () => prng.int(0, 9)).join("");
      return `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
    },
    formatLandline: (prng: Prng) => {
      const area = ["212", "213", "312", "415", "617", "713"][prng.int(0, 5)]!;
      const num = Array.from({ length: 7 }, () => prng.int(0, 9)).join("");
      return `(${area}) ${num.slice(0, 3)}-${num.slice(3)}`;
    },
  },
};
