/**
 * Download English training corpora and emit a single brotli-compressed blob
 * at `packages/locale-en/src/data/blobs/en.br` (the on-disk shape the loader
 * in `packages/locale-en/src/data/index.ts` expects).
 *
 * Sources (B48-R6, R4):
 *   - First names: SSA Baby Names — fetched from a GitHub mirror that ships
 *                  the SSA yearly text files as plain CSV (no zip required).
 *                  Original source: https://www.ssa.gov/oact/babynames (public
 *                  domain, US Social Security Administration). The mirror used
 *                  here is the `hadley/data-baby-names` SSA CSV (columns:
 *                  year,name,percent,sex). MIT-mirrored, content is public
 *                  domain.
 *   - Surnames:    US Census 2010 Surnames (public domain, US Census Bureau),
 *                  fetched from the `fivethirtyeight/data` GitHub mirror at
 *                  `most-common-name/surnames.csv` — this is the unmodified
 *                  Census 2010 file with header `name,rank,count,prop100k,
 *                  cum_prop100k,pctwhite,...`. **Filtered to top-10K by
 *                  frequency (the published `count` column)** per B48-R6.
 *   - Nouns/Adj:   dwyl/english-words `words_alpha.txt` (MIT) with the existing
 *                  4–12 length filter; adjectives are the suffix-heuristic subset
 *                  (B46 Q-S8 — non-blocking, deferred). 5_000 nouns, 3_000 adj.
 *
 * Blob format (per B48-R4, O-1, O-2): single combined brotli blob storing
 * JSON-serialised `{ firstNamesMale, firstNamesFemale, lastNames, nouns,
 * adjectives }`. Decompression is eager-sync at module load (B46 O-A2).
 *
 * Usage: pnpm --filter @zod4-mock/locale-en fetch-data
 *
 * Network fallback: if a fetch fails, the script falls back to the previously
 * committed blob's contents (the loader is the source of truth), so a build
 * without network access doesn't regress shipped data. A first-ever run with
 * no committed blob and no network exits non-zero.
 */

import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blobDir = join(__dirname, "../src/data/blobs");
const blobPath = join(blobDir, "en.br");
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

function loadPreviousBlob(): LocaleBlobShape | undefined {
  if (!existsSync(blobPath)) return undefined;
  const decoded = brotliDecompressSync(readFileSync(blobPath)).toString("utf-8");
  return JSON.parse(decoded) as LocaleBlobShape;
}

const previous = loadPreviousBlob();

// ---------------------------------------------------------------------------
// 1. SSA Baby Names — github mirror of SSA yearly text files
// ---------------------------------------------------------------------------

let firstNamesMale: string[] | undefined;
let firstNamesFemale: string[] | undefined;

console.log("Fetching SSA Baby Names (mirror)…");
try {
  // hadley/data-baby-names: SSA top-1000 baby names by year, 1880-2008.
  // Columns: year,name,percent,sex   (sex ∈ {"boy","girl"}).
  // This is the SSA dataset re-published under MIT licensing of the mirror.
  // Public-domain content + MIT mirror packaging = safe to redistribute.
  const csv = await fetchText(
    "https://raw.githubusercontent.com/hadley/data-baby-names/master/baby-names.csv",
  );
  const lines = csv
    .split("\n")
    .slice(1)
    .filter((l) => l.trim().length > 0);

  // Aggregate: lowercase name + sex, uniquify. Quotes around name column.
  const males = new Set<string>();
  const females = new Set<string>();
  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 4) continue;
    const rawName = cols[1]?.replace(/"/g, "").trim().toLowerCase() ?? "";
    const rawSex = cols[3]?.replace(/"/g, "").trim().toLowerCase() ?? "";
    if (!/^[a-z]+$/.test(rawName)) continue;
    if (rawSex === "boy") males.add(rawName);
    else if (rawSex === "girl") females.add(rawName);
  }

  if (males.size === 0 || females.size === 0) {
    throw new Error(`SSA mirror returned 0 names (males=${males.size}, females=${females.size})`);
  }
  firstNamesMale = [...males].sort();
  firstNamesFemale = [...females].sort();
  console.log(`  ✓ firstNamesMale (${firstNamesMale.length} names)`);
  console.log(`  ✓ firstNamesFemale (${firstNamesFemale.length} names)`);
} catch (e) {
  console.error("  ✗ SSA names failed:", (e as Error).message);
  console.error("    Falling back to previously committed blob contents.");
}

// ---------------------------------------------------------------------------
// 2. US Census 2010 Surnames — top-10K by frequency (B48-R6)
// ---------------------------------------------------------------------------

let lastNames: string[] | undefined;

console.log("Fetching US Census 2010 Surnames (mirror)…");
try {
  // fivethirtyeight/data mirror — unmodified US Census 2010 surnames file.
  // Header: name,rank,count,prop100k,cum_prop100k,pctwhite,pctblack,
  //         pctapi,pctaian,pct2prace,pcthispanic
  const csv = await fetchText(
    "https://raw.githubusercontent.com/fivethirtyeight/data/master/most-common-name/surnames.csv",
  );
  type Row = { name: string; count: number };
  const rows: Row[] = csv
    .split("\n")
    .slice(1) // skip header
    .map((l): Row | null => {
      const cols = l.split(",");
      const name = cols[0]?.toLowerCase().trim();
      const count = Number(cols[2]);
      if (!name || !/^[a-z]+$/.test(name) || !Number.isFinite(count)) return null;
      return { name, count };
    })
    .filter((r): r is Row => r !== null);
  rows.sort((a, b) => b.count - a.count);
  // R6: top 10_000 most-common surnames by `count`, descending frequency order.
  lastNames = rows.slice(0, 10_000).map((r) => r.name);
  if (lastNames.length === 0) throw new Error("Census mirror returned 0 surnames");
  console.log(`  ✓ lastNames (${lastNames.length} names, top-10K filtered)`);
} catch (e) {
  console.error("  ✗ Census surnames failed:", (e as Error).message);
  console.error("    Falling back to previously committed blob contents.");
}

// ---------------------------------------------------------------------------
// 3. English words (nouns + adjectives from dwyl/english-words)
// ---------------------------------------------------------------------------

let nouns: string[] | undefined;
let adjectives: string[] | undefined;

console.log("Fetching English word list…");
try {
  const wordList = await fetchText(
    "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
  );
  const words = wordList
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{4,12}$/.test(w));

  // Heuristic adjective filter (carried over from the pre-B48 fetch script;
  // B46 Q-S8 flags POS-source curation as a separate item).
  const adjSuffixes = [
    "ful",
    "less",
    "ous",
    "ive",
    "ible",
    "able",
    "al",
    "ic",
    "ish",
    "ary",
    "ory",
    "ent",
    "ant",
  ];
  const adj = words.filter((w) => adjSuffixes.some((s) => w.endsWith(s))).slice(0, 3000);
  const adjSet = new Set(adj);
  const nn = words.filter((w) => !adjSet.has(w)).slice(0, 5000);

  nouns = nn;
  adjectives = adj;
  console.log(`  ✓ nouns (${nn.length} words)`);
  console.log(`  ✓ adjectives (${adj.length} words)`);
} catch (e) {
  console.error("  ✗ Word list failed:", (e as Error).message);
  console.error("    Falling back to previously committed blob contents.");
}

// ---------------------------------------------------------------------------
// 4. Compose + brotli-compress + write the blob
// ---------------------------------------------------------------------------

if (!previous && (!firstNamesMale || !firstNamesFemale || !lastNames || !nouns || !adjectives)) {
  console.error(
    "\nFATAL: no committed blob exists and at least one fetch failed. " +
      "Cannot produce a blob from scratch without network access. " +
      "Re-run with network access, or hand-place a starter blob at " +
      `${blobPath}.`,
  );
  process.exit(1);
}

const composed: LocaleBlobShape = {
  firstNamesMale: firstNamesMale ?? previous!.firstNamesMale,
  firstNamesFemale: firstNamesFemale ?? previous!.firstNamesFemale,
  lastNames: lastNames ?? previous!.lastNames,
  nouns: nouns ?? previous!.nouns,
  adjectives: adjectives ?? previous!.adjectives,
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
