import type { LocaleData, LastNamePrefix, Prng } from "@zod4-mock/locale-core";
import { dutchMaleModel, dutchFemaleModel, dutchLastNamesModel } from "@zod4-mock/locale-names/groups/dutch";
import { arabicMaleModel, arabicFemaleModel }     from "@zod4-mock/locale-names/groups/arabic";
import { turkishMaleModel, turkishFemaleModel }   from "@zod4-mock/locale-names/groups/turkish";
import { frisianMaleModel, frisianFemaleModel }   from "@zod4-mock/locale-names/groups/frisian";
import { nlNounsModel } from "./models/nouns.js";
import { nlAdjectivesModel } from "./models/adjectives.js";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Approximate name-origin distribution in the Dutch population:
//   ~68% Dutch-origin, ~12% Arabic, ~6% Turkish, ~2% Frisian, ~12% other (not modelled yet)
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
    jobTitles: [
      "Ontwikkelaar", "Ingenieur", "Manager", "Ontwerper", "Architect", "Consultant",
      "Specialist", "Analist", "Coördinator", "Directeur", "Bestuurder", "Adviseur",
      "Onderzoeker", "Beheerder", "Inspecteur", "Instructeur", "Redacteur", "Medewerker",
    ],
    jobAreas: [
      "Engineering", "Product", "Ontwerp", "Data", "Beveiliging", "Marketing", "Verkoop",
      "Financiën", "Operations", "Juridische Zaken", "HR", "Klantenservice", "Logistiek",
      "Communicatie", "R&D", "Kwaliteitsborging", "Inkoop", "Administratie",
    ],
    jobTypes: ["Lead", "Senior", "Junior", "Hoofd", "Assistent", "Directeur", "Stagiair", "Interim", "Freelance", "Trainee"],
    jobDescriptors: ["Innovatief", "Globaal", "Centraal", "Direct", "Strategisch", "Operationeel", "Dynamisch", "Regionaal", "Internationaal", "Zakelijk"],
    formatFullName: (first, last) => `${first} ${last.charAt(0).toLowerCase() + last.slice(1)}`,
    formatBio: (prng, { jobTitle, jobArea, jobType }) => {
      const t  = jobTitle.toLowerCase();
      const a  = jobArea.toLowerCase();
      const ty = jobType ? jobType.toLowerCase() + " " : "";
      const templates = [
        () => cap(`${ty}${t} gespecialiseerd in ${a}.`),
        () => `Werkzaam als ${ty}${t} in ${a}.`,
        () => cap(`${ty}${t} met een passie voor ${a}.`),
      ] as const;
      return templates[prng.int(0, templates.length - 1)]!();
    },
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
    countryCodes: ["NL", "DE", "BE", "FR", "GB", "AT", "CH", "DK", "SE", "NO", "ES", "IT", "PT", "GR", "IE", "FI", "PL", "CZ", "HU", "RO"],
    continents: ["Afrika", "Antarctica", "Azië", "Europa", "Noord-Amerika", "Oceanië", "Zuid-Amerika"],
    languages: ["Nederlands", "Engels", "Duits", "Frans", "Spaans", "Italiaans", "Portugees", "Deens", "Zweeds", "Noors"],
    streetNames: [
      "Eiken", "Beuken", "Linden", "Berken", "Kastanje", "Iepen", "Meidoorn",
      "Wilgen", "Plataan", "Populier", "Wilhelmina", "Juliana", "Beatrix",
      "Emma", "Willem", "Alexander", "Maurits", "Bernhard", "Margriet", "Irene",
      "Merel", "Lijster", "Vink", "Meeuw", "Arend", "Havik", "Valk",
      "Zwaluw", "Koekoek", "Nachtegaal", "Kerk", "Molen", "Spoor", "Stations",
      "Dorps", "Veld", "Dijk", "Berg", "Heuvel", "Dal", "Rozen", "Tulpen",
      "Lelie", "Anjer", "Narcis", "Madelief", "Boterbloem", "Heide", "Duin", "Zand",
      "Nieuwe", "Oude", "Hoge", "Lage", "Brede", "Smalle", "Lange", "Korte",
      "Noorder", "Zuider", "Ooster", "Wester", "Midden", "Boven", "Beneden",
      "Grote", "Kleine", "Heren", "Dames", "Prinsen", "Konings", "Keizers",
      "Bisschop", "Klooster", "Kasteel", "Burcht", "Slot", "Handel", "Markt",
      "Haven", "Werf", "Fabriek", "Industrie", "Ambacht", "Gilde",
    ],
    streetSuffixes: ["straat", "laan", "weg", "dijk", "steeg", "plein", "hof", "gracht", "singel", "kade", "pad", "dreef", "zoom", "park"],
    cityPrefixes: ["Nieuw-", "Oud-", "Groot-", "Klein-", "Sint-", "Zuid-", "Noord-", "Oost-", "West-"],
    cityCores: ["dam", "drecht", "burg", "hoven", "stad", "lo", "meer", "berg", "mond", "veld", "kerk", "wijk", "beek", "land"],
    buildingNumberSuffixes: ["", "", "", "a", "b", "c", " bis"],
    timeZones: [
      "Europe/Amsterdam", "Europe/London", "Europe/Paris", "Europe/Berlin",
      "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC",
    ],
    directions: ["Noord", "Oost", "Zuid", "West", "Noordoost", "Zuidoost", "Zuidwest", "Noordwest"],
    cardinalDirections: ["Noord", "Oost", "Zuid", "West"],
    ordinalDirections: ["Noordoost", "Zuidoost", "Zuidwest", "Noordwest"],
    streetFormats: [
      (num, name) => `${name}straat ${num}`,
      (num, name) => `${name}laan ${num}`,
      (num, name) => `${name}weg ${num}`,
    ],
    zipFormat: (prng: Prng) =>
      `${prng.int(1000, 9999)} ${String.fromCharCode(prng.int(65, 90))}${String.fromCharCode(prng.int(65, 90))}`,
    secondaryAddressFormat: (n) => `Appartement ${n}`,
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
    formatPrice: (amount) => `€${amount.toFixed(2).replace(".", ",")}`,
    formatProductName: (adjective, material, noun) =>
      `${adjective} ${material.toLowerCase()}en ${noun}`,
    formatProductDescription: ({ productName, adjective, noun, department }) =>
      `${productName}: ${adjective.toLowerCase()} ${noun} voor je ${department.toLowerCase()} behoeften.`,
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
    catchPhraseAdjectives: [
      "Klantgericht", "Gelaagd", "Upgradebaar", "Compatibel", "Hoogwaardig",
      "Vooruitstrevend", "Veelzijdig", "Betrouwbaar", "Veilig", "Toegankelijk",
      "Baanbrekend", "Exclusief", "Superieur", "Essentieel", "Fundamenteel", "Onmisbaar",
    ],
    catchPhraseDescriptors: [
      "optimaal", "24/7", "modulair", "gemonitord", "logistiek",
      "directioneel", "gestroomlijnd", "geautomatiseerd", "gepersonaliseerd", "transparant",
      "flexibel", "schaalbaar", "foutloos", "geïntegreerd", "gedecentraliseerd", "virtueel",
    ],
    catchPhraseNouns: [
      "vermogen", "benutting", "interface", "onvoorzien", "projectie",
      "succes", "efficiëntie", "kwaliteit", "zekerheid", "capaciteit", "groei",
      "prestatie", "ROI", "betrokkenheid", "productiviteit", "flexibiliteit", "innovatie",
    ],
    formatBuzzPhrase: (verb, adj, noun) => `${cap(verb)} ${adj.toLowerCase()} ${noun.toLowerCase()}`,
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
    bicLocations: ["2U", "33", "88", "2A", "9A", "21"],
    currencies: [
      { code: "EUR", name: "Euro",                       symbol: "€",   numeric: "978" },
      { code: "USD", name: "Amerikaanse Dollar",         symbol: "$",   numeric: "840" },
      { code: "GBP", name: "Britse Pond",                symbol: "£",   numeric: "826" },
      { code: "JPY", name: "Japanse Yen",                symbol: "¥",   numeric: "392" },
      { code: "CHF", name: "Zwitserse Frank",            symbol: "CHF", numeric: "756" },
      { code: "CAD", name: "Canadese Dollar",            symbol: "C$",  numeric: "124" },
      { code: "AUD", name: "Australische Dollar",        symbol: "A$",  numeric: "036" },
      { code: "CNY", name: "Chinese Yuan",               symbol: "¥",   numeric: "156" },
      { code: "SEK", name: "Zweedse Kroon",              symbol: "kr",  numeric: "752" },
      { code: "NZD", name: "Nieuw-Zeelandse Dollar",     symbol: "NZ$", numeric: "554" },
    ],
    accountNames: [
      "Spaarrekening", "Betaalrekening", "Zakelijke Rekening", "Creditcard",
      "Beleggingsportefeuille", "Gezamenlijke Rekening", "Pensioenrekening",
      "Kinderrekening", "Lopend Krediet", "Hypotheek",
    ],
    transactionTypes: ["storting", "opname", "betaling", "factuur", "restitutie", "overschrijving", "incasso", "salaris", "rente", "dividend"],
    transactionDescriptions: [
      "Supermarkt", "Maandelijkse huur", "Salaris", "Online winkelen",
      "Tankstation", "Restaurant rekening", "Abonnement", "Koffiebar",
      "Verzekeringspremie", "Energiebelasting", "Kledingwinkel", "Sportschool",
      "Streamingdienst", "Apotheek", "Boekwinkel",
    ],
    formatIban: (prng: Prng, bankCode: string) =>
      `NL${prng.int(10, 99)}${bankCode}${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`,
  },

  date: {
    months: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
    weekdays: ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"],
    weekdaysShort: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
    timeZones: ["UTC", "Europe/Amsterdam", "Europe/London", "Europe/Paris", "Europe/Berlin"],
  },

  color: {
    names: [
      "rood", "blauw", "groen", "geel", "oranje", "paars",
      "roze", "zwart", "wit", "grijs", "bruin", "cyaan",
      "magenta", "limoen", "indigo", "violet", "turkoois", "koraal",
      "karmijn", "goud", "zilver", "marine", "olijf", "kastanjebruin",
    ],
  },

  phone: {
    mobilePrefix: "06",
    landlinePrefixes: ["010", "020", "030", "040", "050", "070", "080", "090"],
    formatMobile: (prng: Prng) => {
      const num = Array.from({ length: 8 }, () => prng.int(0, 9)).join("");
      return `06-${num.slice(0, 4)} ${num.slice(4)}`;
    },
    formatLandline: (prng: Prng) => {
      const prefixes = ["010", "020", "030", "040", "050", "070", "080", "090"];
      const prefix = prefixes[prng.int(0, prefixes.length - 1)]!;
      const num = Array.from({ length: 7 }, () => prng.int(0, 9)).join("");
      return `${prefix}-${num.slice(0, 3)} ${num.slice(3)}`;
    },
  },
};
