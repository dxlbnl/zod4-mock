/**
 * @module age
 * B57-R4: `age` clipped log-normal distribution.
 *
 * Closed-form inverse-CDF via the Beasley–Springer–Moro `normInv` polynomial.
 * Parameters: μ = ln(36), σ = 0.35 → ~95% in [18, 80] (US Census median adult
 * age 2020 = 38.5). For tight bounds (`max - min < 20`), falls back to
 * uniform-int.
 *
 * Pure-`Math.*` only — D13 isomorphic.
 *
 * See B54 research report §2 / B57 spec R4.
 */

import type { Prng } from "../../types.js";

// Beasley–Springer–Moro coefficients (Moro 1995). Three regions of u.
const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
] as const;
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
] as const;
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
] as const;
const D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
] as const;

const P_LOW = 0.02425;
const P_HIGH = 1 - P_LOW;

/**
 * Closed-form inverse of the standard normal CDF — `Φ⁻¹(u)` — via the
 * Beasley–Springer–Moro polynomial. `u ∈ (0, 1)` → standard-normal `z`.
 */
export function normInv(u: number): number {
  if (u < P_LOW) {
    const q = Math.sqrt(-2 * Math.log(u));
    return (
      (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1)
    );
  }
  if (u <= P_HIGH) {
    const q = u - 0.5;
    const r = q * q;
    return (
      ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r + A[5]!) * q) /
      (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - u));
  return -(
    (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
    ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1)
  );
}

/**
 * Clipped log-normal age draw centred on μ = ln(36), σ = 0.35.
 *
 * Tight-bound fallback (`max - min < 20`): uniform-int over `[min, max]`.
 */
export function age(prng: Prng, min = 18, max = 80): number {
  if (max - min < 20) {
    return prng.int(Math.ceil(min), Math.floor(max));
  }
  const u = prng.random();
  const z = normInv(u);
  const raw = Math.exp(Math.log(36) + 0.35 * z);
  return Math.max(min, Math.min(max, Math.round(raw)));
}
