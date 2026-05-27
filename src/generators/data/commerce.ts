import type { Prng, GeneratorContext } from "../../types.js";
import { adjective, noun } from "./word.js";
import { defaultLocale } from "../../default-locale.js";

function pick<T extends string>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

export function department(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).commerce.departments);
}

export function productAdjective(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).commerce.productAdjectives);
}

export function productMaterial(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).commerce.materials);
}

export function productName(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return locale.commerce.formatProductName(
    productAdjective(prng, ctx),
    productMaterial(prng, ctx),
    noun(prng, ctx),
  );
}

export function product(prng: Prng, ctx?: GeneratorContext): string {
  return productName(prng, ctx);
}

export function productDescription(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return locale.commerce.formatProductDescription({
    productName: productName(prng, ctx),
    adjective: adjective(prng, ctx),
    noun: noun(prng, ctx),
    department: department(prng, ctx),
  });
}

export function price(prng: Prng, min = 1, max = 1000, ctx?: GeneratorContext): string {
  const amount = prng.random() * (max - min) + min;
  return (ctx?.locale ?? defaultLocale).commerce.formatPrice(amount);
}

export function isbn(prng: Prng): string {
  return `978-${Array.from({ length: 10 }, () => prng.int(0, 9)).join("")}`;
}

export function upc(prng: Prng): string {
  return Array.from({ length: 12 }, () => prng.int(0, 9)).join("");
}
