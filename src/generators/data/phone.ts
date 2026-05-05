import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const MOBILE_PREFIX = "06";
const LANDLINE_PREFIXES = ["010", "020", "030", "040", "050", "070", "080", "090"] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function number(prng: Prng): string {
  const isMobile = prng.random() < 0.7;
  if (isMobile) {
    const num = Array.from({ length: 8 }, () => prng.int(0, 9)).join("");
    return `${MOBILE_PREFIX}-${num.slice(0, 4)} ${num.slice(4)}`;
  } else {
    const prefix = prng.pick(LANDLINE_PREFIXES);
    const num = Array.from({ length: 7 }, () => prng.int(0, 9)).join("");
    return `${prefix}-${num.slice(0, 3)} ${num.slice(3)}`;
  }
}

export function imei(prng: Prng): string {
  // 15 digits
  return Array.from({ length: 15 }, () => prng.int(0, 9)).join("");
}
