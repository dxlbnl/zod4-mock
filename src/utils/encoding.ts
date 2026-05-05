/**
 * Isomorphic utilities for data encoding.
 */

/**
 * Encodes a string to Base64 in a cross-platform way.
 * Uses native Buffer in Node.js and btoa in the browser.
 */
export function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(str);
  }
  // Fallback for very restricted environments
  return str;
}
