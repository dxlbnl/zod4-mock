/**
 * Locale-en data layer — brotli-blob loader.
 *
 * The five string-array fields are decompressed eagerly at module load
 * (B46 O-A2 recommendation: match today's locale-model load cost).
 * Source blob: `blobs/en.br`, produced by `packages/locale-en/scripts/fetch-data.ts`.
 *
 * Blob format (B48-R4): brotli-compressed JSON of
 * `{ firstNamesMale, firstNamesFemale, lastNames, nouns, adjectives }`.
 */

import { brotliDecompressSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

interface LocaleBlobShape {
  readonly firstNamesMale: readonly string[];
  readonly firstNamesFemale: readonly string[];
  readonly lastNames: readonly string[];
  readonly nouns: readonly string[];
  readonly adjectives: readonly string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const blob = readFileSync(join(__dirname, "blobs/en.br"));
const parsed = JSON.parse(brotliDecompressSync(blob).toString("utf-8")) as LocaleBlobShape;

export const firstNamesMale: readonly string[] = parsed.firstNamesMale;
export const firstNamesFemale: readonly string[] = parsed.firstNamesFemale;
export const lastNames: readonly string[] = parsed.lastNames;
export const nouns: readonly string[] = parsed.nouns;
export const adjectives: readonly string[] = parsed.adjectives;
