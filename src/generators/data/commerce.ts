import type { Prng } from "../../types.js";
import { adjective, noun } from "./word.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const DEPARTMENTS = ["Elektronica", "Kleding", "Huis", "Tuin", "Speelgoed", "Boeken", "Beauty", "Auto", "Sport", "Gezondheid"] as const;
const MATERIALS = ["Hout", "Metaal", "Plastic", "Glas", "Stof", "Steen", "Leer", "Keramiek"] as const;
const PRODUCT_ADJECTIVES = ["Klein", "Ergonomisch", "Rustiek", "Intelligent", "Prachtig", "Ongelooflijk", "Praktisch", "Handgemaakt", "Generiek", "Verfijnd", "Merkloos", "Lekker"] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function department(prng: Prng): string {
  return prng.pick(DEPARTMENTS);
}

export function productAdjective(prng: Prng): string {
  return prng.pick(PRODUCT_ADJECTIVES);
}

export function productMaterial(prng: Prng): string {
  return prng.pick(MATERIALS);
}

export function productName(prng: Prng): string {
  return `${productAdjective(prng)} ${productMaterial(prng).toLowerCase()}en ${noun(prng)}`;
}

export function product(prng: Prng): string {
  return productName(prng);
}

export function productDescription(prng: Prng): string {
  return `${productName(prng)}: ${adjective(prng)} ${noun(prng)} voor je ${department(prng).toLowerCase()} behoeften.`;
}

export function price(prng: Prng, min = 1, max = 1000): string {
  return (prng.random() * (max - min) + min).toFixed(2).replace(".", ",");
}

export function isbn(prng: Prng): string {
  return `978-${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`;
}

export function upc(prng: Prng): string {
  return Array.from({ length: 12 }, () => prng.int(0, 9)).join("");
}
