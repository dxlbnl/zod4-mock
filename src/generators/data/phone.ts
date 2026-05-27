import type { Prng, GeneratorContext } from "../../types.js";
import { defaultLocale } from "../../default-locale.js";

export function number(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return prng.random() < 0.7 ? locale.phone.formatMobile(prng) : locale.phone.formatLandline(prng);
}

export function imei(prng: Prng): string {
  return Array.from({ length: 15 }, () => prng.int(0, 9)).join("");
}
