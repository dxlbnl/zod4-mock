/**
 * Download Dutch training corpora to data/training/.
 *
 * Sources:
 *   - First names: open-nl-data/dutch-names-dataset (Mannen/Vrouwen counts)
 *   - Surnames:    digitalheir/family-names-in-the-netherlands top-1000 (2007 census)
 *   - Nouns/adj:   OpenTaal opentaal-wordlist (BSD/GPL)
 *
 * Usage: pnpm --filter @zod4-mock/locale-nl fetch-data
 */

import { mkdirSync, writeFileSync } from "node:fs";
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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// 1. Dutch first names — open-nl-data/dutch-names-dataset
// ---------------------------------------------------------------------------

console.log("Fetching Dutch first names…");
try {
  type NameEntry = { Voornaam: string; Mannen: number; Vrouwen: number };
  const names = await fetchJson<NameEntry[]>(
    "https://raw.githubusercontent.com/open-nl-data/dutch-names-dataset/main/firstnames.json",
  );

  // Threshold > 100 selects the Dutch-core corpus (~2k–4k names) and discards
  // low-frequency multicultural entries that pollute the Markov model.
  const male = names.filter((n) => n.Mannen > 100).map((n) => n.Voornaam.toLowerCase());
  const female = names.filter((n) => n.Vrouwen > 100).map((n) => n.Voornaam.toLowerCase());

  // Keep only simple Latin-alphabet names the Markov trainer handles
  const clean = (list: string[]) => [...new Set(list.filter((n) => /^[a-z]+$/.test(n)))].join("\n");

  writeFileSync(join(dataDir, "first-names-male.txt"), clean(male), "utf8");
  writeFileSync(join(dataDir, "first-names-female.txt"), clean(female), "utf8");
  console.log(`  ✓ first-names-male.txt (${male.length} names before filter)`);
  console.log(`  ✓ first-names-female.txt (${female.length} names before filter)`);
} catch (e) {
  console.error("  ✗ Dutch first names failed:", (e as Error).message);
}

// ---------------------------------------------------------------------------
// 2. Dutch surnames — digitalheir/family-names-in-the-netherlands
// ---------------------------------------------------------------------------

console.log("Fetching Dutch surnames…");
try {
  const csv = await fetchText(
    "https://raw.githubusercontent.com/digitalheir/family-names-in-the-netherlands/master/top_1000_last_names_in_the_netherlands_2007.csv",
  );
  const names = csv
    .split("\n")
    .slice(1) // skip header
    .map((l) => l.split(",")[0]?.toLowerCase().trim())
    .filter((n): n is string => !!n && /^[a-z ]+$/.test(n))
    // Strip "de ", "van ", "van den " etc. prefixes so trainer sees bare stems
    .map((n) =>
      n.replace(/^(de|van|van de[rn]?|van den|van der|ten|ter|den|der|het|'t)\s+/i, "").trim(),
    )
    .filter((n) => /^[a-z]{3,}$/.test(n));

  writeFileSync(join(dataDir, "last-names.txt"), [...new Set(names)].join("\n"), "utf8");
  console.log(`  ✓ last-names.txt (${names.length} names)`);
} catch (e) {
  console.error("  ✗ Dutch surnames failed:", (e as Error).message);
}

// ---------------------------------------------------------------------------
// 3. Dutch nouns + adjectives — OpenTaal wordlist
// ---------------------------------------------------------------------------

console.log("Fetching OpenTaal word list…");
try {
  const wordList = await fetchText(
    "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/wordlist.txt",
  );
  const words = wordList
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{4,14}$/.test(w));

  // Heuristic: Dutch adjectives often end in these patterns
  const adjSuffixes = ["lijk", "isch", "ig", "baar", "loos", "rijk", "vol", "zaam", "end", "end"];
  const adjectives = words.filter((w) => adjSuffixes.some((s) => w.endsWith(s))).slice(0, 2000);
  const adjSet = new Set(adjectives);
  const nouns = words.filter((w) => !adjSet.has(w)).slice(0, 5000);

  writeFileSync(join(dataDir, "nouns.txt"), nouns.join("\n"), "utf8");
  writeFileSync(join(dataDir, "adjectives.txt"), adjectives.join("\n"), "utf8");
  console.log(`  ✓ nouns.txt (${nouns.length} words)`);
  console.log(`  ✓ adjectives.txt (${adjectives.length} words)`);
} catch (e) {
  console.error("  ✗ OpenTaal word list failed:", (e as Error).message);
}

console.log("\nDone. Run `pnpm train` to regenerate Markov models.");
