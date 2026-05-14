import type { Prng, GeneratorContext } from "../../types.js";
import { defaultLocale } from "../../default-locale.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365 * MS_PER_DAY;

function pick<T extends string>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

export function anytime(prng: Prng): Date {
  const start = new Date("2000-01-01").getTime();
  const end = new Date("2030-12-31").getTime();
  return new Date(start + prng.random() * (end - start));
}

export function between(prng: Prng, start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(startTime + prng.random() * (endTime - startTime));
}

export function betweens(prng: Prng, start: Date, end: Date, count = 3): Date[] {
  return Array.from({ length: count }, () => between(prng, start, end)).sort(
    (a, b) => a.getTime() - b.getTime(),
  );
}

export function past(prng: Prng, years = 1): Date {
  const end = Date.now();
  const start = end - years * MS_PER_YEAR;
  return new Date(start + prng.random() * (end - start));
}

export function future(prng: Prng, years = 1): Date {
  const start = Date.now();
  const end = start + years * MS_PER_YEAR;
  return new Date(start + prng.random() * (end - start));
}

export function recent(prng: Prng, days = 7): Date {
  const end = Date.now();
  const start = end - days * MS_PER_DAY;
  return new Date(start + prng.random() * (end - start));
}

export function soon(prng: Prng, days = 7): Date {
  const start = Date.now();
  const end = start + days * MS_PER_DAY;
  return new Date(start + prng.random() * (end - start));
}

export function birthdate(prng: Prng, minAge = 18, maxAge = 80): Date {
  const now = new Date();
  const start = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate()).getTime();
  const end = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()).getTime();
  return new Date(start + prng.random() * (end - start));
}

export function month(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).date.months);
}

export function weekday(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).date.weekdays);
}

export function timeZone(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).date.timeZones);
}
