import type { Prng } from "../../types.js";

const ALNUM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
const HEX_CHARS = "0123456789abcdef".split("");
const NANOID_CHARS = "ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KPLXTYJQSZ".split("");

export function uuid(prng: Prng): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = prng.int(0, 15);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function alphanumeric(prng: Prng, length = 8): string {
  return Array.from({ length }, () => prng.pick(ALNUM_CHARS as any)).join("");
}

export function hexadecimal(prng: Prng, length = 8): string {
  return "0x" + Array.from({ length }, () => prng.pick(HEX_CHARS as any)).join("");
}

export function nanoid(prng: Prng, length = 21): string {
  return Array.from({ length }, () => prng.pick(NANOID_CHARS as any)).join("");
}
