import type { Prng, GeneratorContext } from "../../types.js";
import { defaultLocale } from "../../default-locale.js";

function pick<T extends string>(prng: Prng, arr: readonly T[]): T {
  return arr[Math.floor(prng.random() * arr.length)] as T;
}

export function colorName(prng: Prng, ctx?: GeneratorContext): string {
  return pick(prng, (ctx?.locale ?? defaultLocale).color.names);
}

export function colorHex(prng: Prng): string {
  const [r, g, b] = prng.bytes(3);
  return "#" + [r!, g!, b!].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function colorRgb(prng: Prng): string {
  return `rgb(${prng.int(0, 255)}, ${prng.int(0, 255)}, ${prng.int(0, 255)})`;
}

export function colorHsl(prng: Prng): string {
  return `hsl(${prng.int(0, 359)}, ${prng.int(0, 100)}%, ${prng.int(0, 100)}%)`;
}
