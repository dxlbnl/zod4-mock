import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const MANUFACTURERS = [
  "Tesla",
  "BMW",
  "Audi",
  "Mercedes-Benz",
  "Toyota",
  "Honda",
  "Ford",
  "Volkswagen",
  "Volvo",
  "Porsche",
  "Hyundai",
  "Kia",
  "Mazda",
  "Peugeot",
  "Renault",
  "Citroën",
  "Fiat",
  "Nissan",
  "Chevrolet",
  "Subaru",
  "Lexus",
  "Jaguar",
  "Land Rover",
  "Jeep",
  "Mini",
] as const;
const VEHICLE_TYPES = [
  "Sedan",
  "SUV",
  "Hatchback",
  "Coupé",
  "Cabriolet",
  "Bestelwagen",
  "Vrachtwagen",
  "Elektrisch",
  "Minivan",
  "Pick-up",
  "Stationwagen",
  "Crossover",
  "Camper",
  "Sportwagen",
] as const;
const COLORS = [
  "Rood",
  "Blauw",
  "Zwart",
  "Wit",
  "Zilver",
  "Grijs",
  "Groen",
  "Geel",
  "Oranje",
  "Donkerblauw",
  "Bordeauxrood",
  "Lichtblauw",
  "Donkergroen",
  "Paars",
  "Roze",
  "Bruin",
  "Goud",
  "Brons",
  "Matzwart",
] as const;
const FUELS = ["Benzine", "Diesel", "Elektrisch", "Hybride", "Waterstof", "LPG", "CNG", "PHEV"] as const;

const MODELS = [
  "Model 3",
  "X5",
  "A4",
  "C-Class",
  "Corolla",
  "Civic",
  "F-150",
  "Golf",
  "XC90",
  "911",
  "Ioniq 5",
  "EV6",
  "CX-5",
  "Mustang",
  "Focus",
  "Yaris",
  "Clio",
  "208",
  "500",
  "Qashqai",
  "Tucson",
  "Sportage",
  "Octavia",
  "Leon",
  "Astra",
  "Corsa",
  "Megane",
  "Passat",
  "Tiguan",
  "Model Y",
  "Model S",
  "Model X",
] as const;
const BICYCLE_BRANDS = ["Gazelle", "Batavus", "VanMoof", "Giant", "Specialized", "Trek", "Cortina", "Stella", "Koga", "Sparta", "Pegasus", "Canyon", "Cube"] as const;

const VIN_CHARS = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ".split("") as [string, ...string[]];
const VRM_LETTERS = "BCDFGHJKLMNPQRSTVWXYZ".split("") as [string, ...string[]];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function manufacturer(prng: Prng): string {
  return prng.pick(MANUFACTURERS);
}

export function type(prng: Prng): string {
  return prng.pick(VEHICLE_TYPES);
}

export function model(prng: Prng): string {
  return prng.pick(MODELS);
}

export function vehicle(prng: Prng): string {
  return `${manufacturer(prng)} ${model(prng)}`;
}

export function color(prng: Prng): string {
  return prng.pick(COLORS);
}

export function fuel(prng: Prng): string {
  return prng.pick(FUELS);
}

export function vin(prng: Prng): string {
  return Array.from({ length: 17 }, () => prng.pick(VIN_CHARS)).join("");
}

export function vrm(prng: Prng): string {
  return `${prng.pick(VRM_LETTERS)}${prng.pick(VRM_LETTERS)}-${prng.int(100, 999)}-${prng.pick(VRM_LETTERS)}`;
}

export function bicycle(prng: Prng): string {
  return prng.pick(BICYCLE_BRANDS);
}
