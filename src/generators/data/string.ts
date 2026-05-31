import type { Prng } from "../../types.js";

const ALNUM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("") as [
  string,
  ...string[],
];
const NANOID_CHARS = "ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KPLXTYJQSZ".split("") as [
  string,
  ...string[],
];

export const LOWERCASE_ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";
export const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
export const ULID_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function uuid(prng: Prng): string {
  const b = prng.bytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(b, (v) => v!.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function alphanumeric(prng: Prng, length = 8): string {
  const b = prng.bytes(length);
  return Array.from(b, (v) => ALNUM_CHARS[v! % ALNUM_CHARS.length]!).join("");
}

export function hexadecimal(prng: Prng, length = 8): string {
  const b = prng.bytes(Math.ceil(length / 2));
  return (
    "0x" +
    Array.from(b, (v) => v!.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, length)
  );
}

export function nanoid(prng: Prng, length = 21): string {
  const b = prng.bytes(length);
  return Array.from(b, (v) => NANOID_CHARS[v! % NANOID_CHARS.length]!).join("");
}
