/**
 * Download Dutch training corpora and emit a single brotli-compressed blob
 * at `packages/locale-nl/src/data/blobs/nl.br` (the on-disk shape the loader
 * in `packages/locale-nl/src/data/index.ts` expects).
 *
 * Sources (B48-R5, R4):
 *   - First names: open-nl-data/dutch-names-dataset (MIT, B46 Q-S1).
 *     Fetched from a GitHub raw URL. Mannen > 100 / Vrouwen > 100 thresholds
 *     select the Dutch-core corpus and discard low-frequency entries.
 *   - Surnames:    **Best-effort — see B48 Phase 2 NOTE below.** The B48-R5
 *     spec says surnames MUST be refetched from CBS (Statistics Netherlands)
 *     or Meertens directly. CBS does NOT publish a bulk Dutch-surname dataset
 *     through `opendata.cbs.nl` (their published surname work covers per-name
 *     frequency lookups but not a bulk top-N download); Meertens' NFB
 *     (Nederlandse Familienamenbank) ships data as a paginated HTML browser
 *     UI, not as a bulk JSON/CSV download. Both options require either an
 *     offline scrape or a manual export.
 *
 *     This script falls back to the corpus shipped in `locale-names`'s
 *     prior Dutch surname slice (Phase 1 migrated this into the committed
 *     `last-names.ts` of `locale-nl`). The provenance of that slice traces
 *     back to a 2007 Dutch top-1000 surname survey (Meertens NFB-derived).
 *     A CBS/Meertens bulk refetch is filed as a follow-up enhancement; the
 *     header comment is preserved in the data layer so reviewers see the
 *     trade-off.
 *   - Nouns/Adj:   OpenTaal opentaal-wordlist (BSD/GPL — Dutch open word
 *     list). Heuristic adjective filter (suffix-based) carried over from the
 *     Phase 1 stub; POS curation deferred (same as B48 Q-S8 deferral on the
 *     EN side).
 *
 * Blob format (per B48-R4, O-1, O-2): single combined brotli blob storing
 * JSON-serialised `{ firstNamesMale, firstNamesFemale, lastNames, nouns,
 * adjectives }`. Decompression is eager-sync at module load (B46 O-A2).
 *
 * Usage: pnpm --filter @zod4-mock/locale-nl fetch-data
 *
 * Network fallback: if a fetch fails, the script falls back to the previously
 * committed blob's contents (the loader is the source of truth) so a build
 * without network access doesn't regress shipped data. A first-ever run with
 * no committed blob and no network falls back to the FALLBACK_* constants
 * below — these inline the Phase 1 migrated corpus.
 */

import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FALLBACK_FIRST_NAMES_MALE,
  FALLBACK_FIRST_NAMES_FEMALE,
  FALLBACK_LAST_NAMES,
  FALLBACK_NOUNS,
  FALLBACK_ADJECTIVES,
} from "./fallback-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blobDir = join(__dirname, "../src/data/blobs");
const blobPath = join(blobDir, "nl.br");
mkdirSync(blobDir, { recursive: true });

interface LocaleBlobShape {
  firstNamesMale: string[];
  firstNamesFemale: string[];
  lastNames: string[];
  nouns: string[];
  adjectives: string[];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json() as Promise<T>;
}

function loadPreviousBlob(): LocaleBlobShape | undefined {
  if (!existsSync(blobPath)) return undefined;
  const decoded = brotliDecompressSync(readFileSync(blobPath)).toString("utf-8");
  return JSON.parse(decoded) as LocaleBlobShape;
}

const previous = loadPreviousBlob();

// ---------------------------------------------------------------------------
// 1. Dutch first names — open-nl-data/dutch-names-dataset (MIT)
// ---------------------------------------------------------------------------

let firstNamesMale: string[] | undefined;
let firstNamesFemale: string[] | undefined;

console.log("Fetching Dutch first names (open-nl-data)…");
try {
  // Try the documented file paths in turn; the repo has reorganised more than
  // once. First-known-good path wins; failures fall through to the fallback.
  type NameEntry = { Voornaam: string; Mannen: number; Vrouwen: number };
  const candidates = [
    "https://raw.githubusercontent.com/open-nl-data/dutch-names-dataset/main/firstnames.json",
    "https://raw.githubusercontent.com/open-nl-data/dutch-names-dataset/master/firstnames.json",
    "https://raw.githubusercontent.com/open-nl-data/dutch-names-dataset/main/data/firstnames.json",
  ];
  let names: NameEntry[] | undefined;
  let lastErr: Error | undefined;
  for (const url of candidates) {
    try {
      names = await fetchJson<NameEntry[]>(url);
      console.log(`  source: ${url}`);
      break;
    } catch (e) {
      lastErr = e as Error;
    }
  }
  if (!names) throw lastErr ?? new Error("all open-nl-data candidates failed");

  const cleanList = (raw: string[]): string[] =>
    [
      ...new Set(
        raw
          .map((n) => n.trim())
          .filter((n) => /^[A-Z][a-z]+$/.test(n))
          .map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()),
      ),
    ].sort();

  // Threshold > 100 selects the Dutch-core corpus and discards low-frequency
  // multicultural entries (carried over from Phase 1 spec note).
  firstNamesMale = cleanList(names.filter((n) => n.Mannen > 100).map((n) => n.Voornaam));
  firstNamesFemale = cleanList(names.filter((n) => n.Vrouwen > 100).map((n) => n.Voornaam));
  if (firstNamesMale.length === 0 || firstNamesFemale.length === 0) {
    throw new Error("Dutch first-name source returned an empty list after filter");
  }
  console.log(`  ✓ firstNamesMale (${firstNamesMale.length} names)`);
  console.log(`  ✓ firstNamesFemale (${firstNamesFemale.length} names)`);
} catch (e) {
  console.error("  ✗ Dutch first names failed:", (e as Error).message);
  console.error("    Falling back to inline migrated corpus.");
}

// ---------------------------------------------------------------------------
// 2. Dutch surnames — best-effort; see header NOTE.
// ---------------------------------------------------------------------------

// We intentionally do NOT fetch from `digitalheir/family-names-in-the-netherlands`
// (license-undeclared, R5 forbids shipping it). CBS and Meertens do not
// expose a trivially-fetchable bulk list. The fallback below is the
// already-committed Phase 1 corpus.
const lastNames: string[] | undefined = undefined;

console.log("Fetching Dutch surnames…");
console.log("  ⓘ No bulk CBS/Meertens endpoint — using inline migrated corpus.");

// ---------------------------------------------------------------------------
// 3. Dutch nouns + adjectives — OpenTaal wordlist
// ---------------------------------------------------------------------------

let nouns: string[] | undefined;
let adjectives: string[] | undefined;

console.log("Fetching OpenTaal word list…");
try {
  const wordList = await fetchText(
    "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/wordlist.txt",
  );
  const words = wordList
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{4,14}$/.test(w));

  // Heuristic: Dutch adjectives often end in these patterns.
  const adjSuffixes = ["lijk", "isch", "ig", "baar", "loos", "rijk", "vol", "zaam"];
  const adj = words.filter((w) => adjSuffixes.some((s) => w.endsWith(s))).slice(0, 2000);
  const adjSet = new Set(adj);
  const nn = words.filter((w) => !adjSet.has(w)).slice(0, 5000);

  if (nn.length === 0 || adj.length === 0) {
    throw new Error(`OpenTaal returned empty buckets (nouns=${nn.length}, adj=${adj.length})`);
  }
  nouns = nn;
  adjectives = adj;
  console.log(`  ✓ nouns (${nn.length} words)`);
  console.log(`  ✓ adjectives (${adj.length} words)`);
} catch (e) {
  console.error("  ✗ OpenTaal word list failed:", (e as Error).message);
  console.error("    Falling back to inline curated stubs.");
}

// ---------------------------------------------------------------------------
// 4. Compose + brotli-compress + write the blob
// ---------------------------------------------------------------------------

// Precedence: fresh fetch > previous blob > inline fallback constants.
const composed: LocaleBlobShape = {
  firstNamesMale: firstNamesMale ?? previous?.firstNamesMale ?? [...FALLBACK_FIRST_NAMES_MALE],
  firstNamesFemale: firstNamesFemale ??
    previous?.firstNamesFemale ?? [...FALLBACK_FIRST_NAMES_FEMALE],
  lastNames: lastNames ?? previous?.lastNames ?? [...FALLBACK_LAST_NAMES],
  nouns: nouns ?? previous?.nouns ?? [...FALLBACK_NOUNS],
  adjectives: adjectives ?? previous?.adjectives ?? [...FALLBACK_ADJECTIVES],
};

const json = JSON.stringify(composed);
const blob = brotliCompressSync(Buffer.from(json, "utf-8"), {
  params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
});
writeFileSync(blobPath, blob);

console.log(`\n✓ Wrote ${blobPath}`);
console.log(`  blob size: ${blob.length} bytes (json: ${json.length} bytes)`);
console.log(`  firstNamesMale:   ${composed.firstNamesMale.length}`);
console.log(`  firstNamesFemale: ${composed.firstNamesFemale.length}`);
console.log(`  lastNames:        ${composed.lastNames.length}`);
console.log(`  nouns:            ${composed.nouns.length}`);
console.log(`  adjectives:       ${composed.adjectives.length}`);
