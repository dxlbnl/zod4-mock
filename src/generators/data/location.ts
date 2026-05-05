import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const STREET_PREFIXES = [
  "Eiken",
  "Beuken",
  "Linden",
  "Berken",
  "Kastanje",
  "Iepen",
  "Meidoorn",
  "Wilgen",
  "Plataan",
  "Populier",
  "Wilhelmina",
  "Juliana",
  "Beatrix",
  "Emma",
  "Willem",
  "Alexander",
  "Maurits",
  "Bernhard",
  "Margriet",
  "Irene",
  "Merel",
  "Lijster",
  "Vink",
  "Meeuw",
  "Arend",
  "Havik",
  "Valk",
  "Zwaluw",
  "Koekoek",
  "Nachtegaal",
  "Kerk",
  "Molen",
  "Spoor",
  "Stations",
  "Dorps",
  "Veld",
  "Dijk",
  "Berg",
  "Heuvel",
  "Dal",
  "Rozen",
  "Tulpen",
  "Lelie",
  "Anjer",
  "Narcis",
  "Madelief",
  "Boterbloem",
  "Heide",
  "Duin",
  "Zand",
  "Nieuwe",
  "Oude",
  "Hoge",
  "Lage",
  "Brede",
  "Smalle",
  "Lange",
  "Korte",
  "Noorder",
  "Zuider",
  "Ooster",
  "Wester",
  "Midden",
  "Boven",
  "Beneden",
  "Grote",
  "Kleine",
  "Vier",
  "Zeven",
  "Tien",
  "Heren",
  "Dames",
  "Prinsen",
  "Konings",
  "Keizers",
  "Bisschop",
  "Klooster",
  "Kasteel",
  "Burcht",
  "Slot",
  "Handel",
  "Markt",
  "Haven",
  "Werf",
  "Fabriek",
  "Industrie",
  "Ambacht",
  "Gilde",
  "Smederij",
  "Bakkerij",
] as const;

const STREET_SUFFIXES = [
  "straat",
  "laan",
  "weg",
  "dijk",
  "steeg",
  "plein",
  "hof",
  "gracht",
  "singel",
  "kade",
  "pad",
  "dreef",
  "zoom",
  "park",
] as const;

const CITY_PREFIXES = [
  "Nieuw-",
  "Oud-",
  "Groot-",
  "Klein-",
  "Sint-",
  "Zuid-",
  "Noord-",
  "Oost-",
  "West-",
] as const;
const CITY_CORES = [
  "dam",
  "drecht",
  "burg",
  "hoven",
  "stad",
  "lo",
  "meer",
  "berg",
  "mond",
  "veld",
  "kerk",
  "wijk",
  "beek",
  "land",
] as const;

const REAL_CITIES = [
  "Amsterdam",
  "Rotterdam",
  "Utrecht",
  "Den Haag",
  "Eindhoven",
  "Groningen",
  "Tilburg",
  "Almere",
  "Breda",
  "Nijmegen",
  "Enschede",
  "Apeldoorn",
  "Haarlem",
  "Arnhem",
  "Amersfoort",
  "Zaanstad",
  "Den Bosch",
  "Haarlemmermeer",
  "Zwolle",
  "Zoetermeer",
  "Leiden",
  "Leeuwarden",
  "Dordrecht",
  "Maastricht",
  "Ede",
  "Alphen aan den Rijn",
  "Westland",
  "Alkmaar",
  "Emmen",
  "Delft",
  "Venlo",
  "Deventer",
  "Helmond",
  "Sittard-Geleen",
  "Oss",
  "Amstelveen",
  "Heerlen",
  "Súdwest-Fryslân",
  "Hengelo",
  "Purmerend",
  "Roosendaal",
  "Schiedam",
  "Lelystad",
  "Almelo",
  "Hoorn",
  "Vlaardingen",
  "Gouda",
  "Velsen",
  "Bergen op Zoom",
  "Capelle aan den IJssel",
] as const;

const COUNTRIES = [
  "Nederland",
  "Duitsland",
  "België",
  "Frankrijk",
  "Verenigd Koninkrijk",
  "Oostenrijk",
  "Zwitserland",
  "Denemarken",
  "Zweden",
  "Noorwegen",
  "Spanje",
  "Italië",
  "Portugal",
  "Griekenland",
  "Ierland",
  "Finland",
  "Polen",
  "Tsjechië",
  "Hongarije",
  "Roemenië",
] as const;
const COUNTRY_CODES = [
  "NL",
  "DE",
  "BE",
  "FR",
  "GB",
  "AT",
  "CH",
  "DK",
  "SE",
  "NO",
  "ES",
  "IT",
  "PT",
  "GR",
  "IE",
  "FI",
  "PL",
  "CZ",
  "HU",
  "RO",
] as const;
const CONTINENTS = [
  "Afrika",
  "Antarctica",
  "Azië",
  "Europa",
  "Noord-Amerika",
  "Oceanië",
  "Zuid-Amerika",
] as const;
const LANGUAGES = [
  "Nederlands",
  "Engels",
  "Duits",
  "Frans",
  "Spaans",
  "Italiaans",
  "Portugees",
  "Deens",
  "Zweeds",
  "Noors",
] as const;

const STATES = [
  "Noord-Holland",
  "Zuid-Holland",
  "Utrecht",
  "Noord-Brabant",
  "Gelderland",
  "Overijssel",
  "Flevoland",
  "Groningen",
  "Friesland",
  "Drenthe",
  "Zeeland",
  "Limburg",
] as const;

const BUILDING_SUFFIXES = ["a", "b", "c", " bis"] as const;

const TIME_ZONES = [
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
] as const;

const DIRECTIONS = [
  "Noord",
  "Oost",
  "Zuid",
  "West",
  "Noordoost",
  "Zuidoost",
  "Zuidwest",
  "Noordwest",
] as const;
const CARDINAL_DIRECTIONS = ["Noord", "Oost", "Zuid", "West"] as const;
const ORDINAL_DIRECTIONS = ["Noordoost", "Zuidoost", "Zuidwest", "Noordwest"] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function street(prng: Prng): string {
  return prng.pick(STREET_PREFIXES) + prng.pick(STREET_SUFFIXES);
}

export function buildingNumber(prng: Prng): string {
  const num = prng.int(1, 200);
  const suffix = prng.random() < 0.1 ? prng.pick(BUILDING_SUFFIXES) : "";
  return `${num}${suffix}`;
}

export function streetAddress(prng: Prng): string {
  return `${street(prng)} ${buildingNumber(prng)}`;
}

export function secondaryAddress(prng: Prng): string {
  return `Appartement ${prng.int(1, 50)}`;
}

export function zipCode(prng: Prng): string {
  return `${prng.int(1000, 9999)} ${String.fromCharCode(prng.int(65, 90))}${String.fromCharCode(prng.int(65, 90))}`;
}

export function city(prng: Prng): string {
  if (prng.random() < 0.7) {
    return prng.pick(REAL_CITIES);
  }
  if (prng.random() < 0.2) {
    return prng.pick(CITY_PREFIXES) + prng.pick(STREET_PREFIXES);
  }
  return prng.pick(STREET_PREFIXES) + prng.pick(CITY_CORES);
}

export function state(prng: Prng): string {
  return prng.pick(STATES);
}

export function county(prng: Prng): string {
  return prng.pick(STATES);
}

export function country(prng: Prng): string {
  return prng.pick(COUNTRIES);
}

export function countryCode(prng: Prng): string {
  return prng.pick(COUNTRY_CODES);
}

export function continent(prng: Prng): string {
  return prng.pick(CONTINENTS);
}

export function language(prng: Prng): string {
  return prng.pick(LANGUAGES);
}

export function latitude(prng: Prng): number {
  return prng.random() * 180 - 90;
}

export function longitude(prng: Prng): number {
  return prng.random() * 360 - 180;
}

export function timeZone(prng: Prng): string {
  return prng.pick(TIME_ZONES);
}

export function direction(prng: Prng): string {
  return prng.pick(DIRECTIONS);
}

export function cardinalDirection(prng: Prng): string {
  return prng.pick(CARDINAL_DIRECTIONS);
}

export function ordinalDirection(prng: Prng): string {
  return prng.pick(ORDINAL_DIRECTIONS);
}
