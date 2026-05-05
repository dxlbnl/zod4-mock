import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const MANUFACTURERS = ["Tesla", "BMW", "Audi", "Mercedes-Benz", "Toyota", "Honda", "Ford", "Volkswagen", "Volvo", "Porsche", "Hyundai", "Kia", "Mazda"] as const;
const VEHICLE_TYPES = ["Sedan", "SUV", "Hatchback", "Coupé", "Cabriolet", "Bestelwagen", "Vrachtwagen", "Elektrisch"] as const;
const COLORS = ["Rood", "Blauw", "Zwart", "Wit", "Zilver", "Grijs", "Groen", "Geel", "Oranje", "Donkerblauw"] as const;
const FUELS = ["Benzine", "Diesel", "Elektrisch", "Hybride", "Waterstof"] as const;

const MODELS = ["Model 3", "X5", "A4", "C-Klasse", "Corolla", "Civic", "F-150", "Golf", "XC90", "911", "Ioniq 5", "EV6", "CX-5"] as const;
const BICYCLE_BRANDS = ["Gazelle", "Batavus", "VanMoof", "Giant", "Specialized", "Trek"] as const;

const VRM_LETTERS = "BCDFGHJKLMNPQRSTVWXYZ".split("");
const VIN_CHARS = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ".split("");

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
  return Array.from({ length: 17 }, () => prng.pick(VIN_CHARS as any)).join("");
}

export function vrm(prng: Prng): string {
  return `${prng.pick(VRM_LETTERS as any)}${prng.pick(VRM_LETTERS as any)}-${prng.int(100, 999)}-${prng.pick(VRM_LETTERS as any)}`;
}

export function bicycle(prng: Prng): string {
  return prng.pick(BICYCLE_BRANDS);
}
