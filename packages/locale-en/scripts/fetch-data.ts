/**
 * Download English training corpora to data/training/.
 *
 * Sources:
 *   - First names: SSA Baby Names 2023 (public domain, US government)
 *   - Surnames:    US Census 2010 Surnames (public domain, US Census Bureau)
 *   - Nouns:       dwyl/english-words filtered word list (MIT)
 *   - Adjectives:  same source, heuristically filtered
 *
 * Usage: pnpm --filter @zod4-mock/locale-en fetch-data
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data/training");
mkdirSync(dataDir, { recursive: true });

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// 1. SSA Baby Names 2023
// ---------------------------------------------------------------------------

console.log("Fetching SSA Baby Names 2023…");
try {
  // Download names.zip and extract yob2023.txt via unzip
  execSync(
    `curl -sL "https://www.ssa.gov/oact/babynames/names.zip" -o /tmp/ssa-names.zip && ` +
    `unzip -p /tmp/ssa-names.zip yob2023.txt > /tmp/yob2023.txt`,
    { stdio: "inherit" },
  );

  const raw = (await import("node:fs")).readFileSync("/tmp/yob2023.txt", "utf8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const male   = lines.filter((l) => l.split(",")[1] === "M").map((l) => l.split(",")[0]!.toLowerCase());
  const female = lines.filter((l) => l.split(",")[1] === "F").map((l) => l.split(",")[0]!.toLowerCase());

  writeFileSync(join(dataDir, "first-names-male.txt"),   [...new Set(male)].join("\n"),   "utf8");
  writeFileSync(join(dataDir, "first-names-female.txt"), [...new Set(female)].join("\n"), "utf8");
  console.log(`  ✓ first-names-male.txt (${male.length} names)`);
  console.log(`  ✓ first-names-female.txt (${female.length} names)`);
} catch (e) {
  console.error("  ✗ SSA names failed:", (e as Error).message);
  console.error("    Install curl and unzip, or manually place yob2023.txt in /tmp/");
}

// ---------------------------------------------------------------------------
// 2. US Census 2010 Surnames
// ---------------------------------------------------------------------------

console.log("Fetching US Census 2010 Surnames…");
try {
  const csv = await fetchText(
    "https://www2.census.gov/topics/genealogy/2010surnames/Names_2010Census.csv",
  );
  const names = csv
    .split("\n")
    .slice(1) // skip header
    .map((l) => l.split(",")[0]?.toLowerCase().trim())
    .filter((n): n is string => !!n && /^[a-z]+$/.test(n));

  writeFileSync(join(dataDir, "last-names.txt"), [...new Set(names)].join("\n"), "utf8");
  console.log(`  ✓ last-names.txt (${names.length} names)`);
} catch (e) {
  console.error("  ✗ Census surnames failed:", (e as Error).message);
}

// ---------------------------------------------------------------------------
// 3. English words (nouns + adjectives from dwyl/english-words)
// ---------------------------------------------------------------------------

console.log("Fetching English word list…");
try {
  const wordList = await fetchText(
    "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
  );
  const words = wordList
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{4,12}$/.test(w));

  // Heuristic: adjectives often end in these suffixes
  const adjSuffixes = ["ful", "less", "ous", "ive", "ible", "able", "al", "ic", "ish", "ary", "ory", "ent", "ant"];
  const adjectives = words.filter((w) => adjSuffixes.some((s) => w.endsWith(s))).slice(0, 3000);
  // Nouns: everything else (rough heuristic)
  const adjSet = new Set(adjectives);
  const nouns = words.filter((w) => !adjSet.has(w)).slice(0, 5000);

  writeFileSync(join(dataDir, "nouns.txt"), nouns.join("\n"), "utf8");
  writeFileSync(join(dataDir, "adjectives.txt"), adjectives.join("\n"), "utf8");
  console.log(`  ✓ nouns.txt (${nouns.length} words)`);
  console.log(`  ✓ adjectives.txt (${adjectives.length} words)`);
} catch (e) {
  console.error("  ✗ Word list failed:", (e as Error).message);
}

console.log("\nDone. Run `pnpm train` to regenerate Markov models.");
