import type { Prng, GeneratorContext } from "../../types.js";
import { defaultLocale } from "../../default-locale.js";

function pick<T>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

export function street(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  return pick(prng, locale.address.streetNames) + pick(prng, locale.address.streetSuffixes);
}

export function buildingNumber(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const num = prng.int(1, 200);
  const suffix = pick(prng, locale.address.buildingNumberSuffixes);
  return `${num}${suffix}`;
}

export function streetAddress(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const num = `${prng.int(1, 200)}`;
  const name = pick(prng, locale.address.streetNames);
  const format = pick(prng, locale.address.streetFormats);
  return format(num, name);
}

export function secondaryAddress(prng: Prng, ctx?: GeneratorContext): string {
  return (ctx?.locale ?? defaultLocale).address.secondaryAddressFormat(prng.int(1, 50));
}

export function zipCode(prng: Prng, ctx?: GeneratorContext): string {
  return (ctx?.locale ?? defaultLocale).address.zipFormat(prng);
}

export function city(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  if (prng.random() < 0.7) {
    return pick(prng, locale.address.cities);
  }
  if (prng.random() < 0.2) {
    return pick(prng, locale.address.cityPrefixes) + pick(prng, locale.address.streetNames);
  }
  return pick(prng, locale.address.streetNames) + pick(prng, locale.address.cityCores);
}

export function state(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.states);
}

export function county(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.states);
}

export function country(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.countries);
}

export function countryCode(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.countryCodes);
}

export function continent(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.continents);
}

export function language(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.languages);
}

export function latitude(prng: Prng): number {
  return prng.random() * 180 - 90;
}

export function longitude(prng: Prng): number {
  return prng.random() * 360 - 180;
}

export function timeZone(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.timeZones);
}

export function direction(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.directions);
}

export function cardinalDirection(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.cardinalDirections);
}

export function ordinalDirection(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).address.ordinalDirections);
}
