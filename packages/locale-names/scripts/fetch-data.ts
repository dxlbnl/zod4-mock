/**
 * Download training corpora for all cultural name groups to data/training/.
 *
 * Sources:
 *   dutch/   — open-nl-data/dutch-names-dataset, frequency-filtered + rule-classified
 *   arabic/  — extracted from Dutch registry via rule-based classifier (Dutch transliteration)
 *   turkish/ — extracted from Dutch registry via rule-based classifier
 *   english/ — arineng/arincli (first names) + smashew/NameDatabases (surnames)
 *
 * Dutch frequency strategy:
 *   The Dutch registry contains names from many cultural origins. Rather than
 *   trying to enumerate every non-Dutch origin, we use a high frequency threshold
 *   (DUTCH_MIN_FREQ) to keep only the most-used names. Names reaching 500+
 *   registrations in the Netherlands are overwhelmingly Dutch/Germanic — obscure
 *   international names typically fall well below this threshold.
 *
 * Usage: pnpm --filter @zod4-mock/locale-names fetch-data
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyByRule } from "./classify-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data/training");

// Names with fewer than this many registrations in the Dutch registry are
// excluded from the Dutch corpus. Other-origin groups use a much lower bar
// (ORIGIN_MIN_FREQ) because they're rare in Dutch regardless.
const DUTCH_MIN_FREQ = 500;
const ORIGIN_MIN_FREQ = 5;

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
// Dutch registry — split into cultural groups using rule-based classifier
// ---------------------------------------------------------------------------

console.log("Fetching Dutch registry and classifying into cultural groups…");
try {
  type NameEntry = { Voornaam: string; Mannen: number; Vrouwen: number };
  const allNames = await fetchJson<NameEntry[]>(
    "https://raw.githubusercontent.com/open-nl-data/dutch-names-dataset/main/firstnames.json",
  );

  const groups = ["dutch", "arabic", "turkish", "south-asian", "frisian"] as const;
  type Group = (typeof groups)[number];

  const male: Record<Group, string[]> = {
    dutch: [],
    arabic: [],
    turkish: [],
    "south-asian": [],
    frisian: [],
  };
  const female: Record<Group, string[]> = {
    dutch: [],
    arabic: [],
    turkish: [],
    "south-asian": [],
    frisian: [],
  };

  for (const entry of allNames) {
    const name = entry.Voornaam.toLowerCase();
    if (!/^[a-z]+$/.test(name)) continue;

    const group = (classifyByRule(name) ?? "dutch") as Group;

    if (group === "dutch") {
      // High threshold — only the most-used names pass. At this level the corpus
      // is overwhelmingly Dutch/Germanic; rare international names fall below it.
      if (entry.Mannen >= DUTCH_MIN_FREQ) male.dutch.push(name);
      if (entry.Vrouwen >= DUTCH_MIN_FREQ) female.dutch.push(name);
    } else {
      // Other-origin names are already rare in the Dutch registry; a low floor
      // is enough to exclude obvious data errors.
      if (entry.Mannen >= ORIGIN_MIN_FREQ) male[group].push(name);
      if (entry.Vrouwen >= ORIGIN_MIN_FREQ) female[group].push(name);
    }
  }

  for (const group of groups) {
    const m = [...new Set(male[group])];
    const f = [...new Set(female[group])];
    if (m.length === 0 && f.length === 0) continue;
    mkdirSync(join(dataDir, group), { recursive: true });
    if (m.length > 0) writeFileSync(join(dataDir, group, "male.txt"), m.join("\n"), "utf8");
    if (f.length > 0) writeFileSync(join(dataDir, group, "female.txt"), f.join("\n"), "utf8");
    console.log(`  ✓ ${group}/male.txt (${m.length}), ${group}/female.txt (${f.length})`);
  }
} catch (e) {
  console.error("  ✗ Dutch registry fetch/classify failed:", (e as Error).message);
}

console.log("Fetching Dutch surnames…");
try {
  const csv = await fetchText(
    "https://raw.githubusercontent.com/digitalheir/family-names-in-the-netherlands/master/top_1000_last_names_in_the_netherlands_2007.csv",
  );
  const names = csv
    .split("\n")
    .slice(1)
    .map((l) => l.split(",")[0]?.toLowerCase().trim())
    .filter((n): n is string => !!n && /^[a-z ]+$/.test(n))
    .map((n) =>
      n.replace(/^(de|van|van de[rn]?|van den|van der|ten|ter|den|der|het|'t)\s+/i, "").trim(),
    )
    .filter((n) => /^[a-z]{3,}$/.test(n));

  writeFileSync(join(dataDir, "dutch/last-names.txt"), [...new Set(names)].join("\n"), "utf8");
  console.log(`  ✓ dutch/last-names.txt (${names.length} names)`);
} catch (e) {
  console.error("  ✗ Dutch surnames failed:", (e as Error).message);
}

// ---------------------------------------------------------------------------
// English — english/
// ---------------------------------------------------------------------------

console.log("Fetching English first names (arineng/arincli)…");
try {
  mkdirSync(join(dataDir, "english"), { recursive: true });

  const clean = (text: string): string[] => [
    ...new Set(
      text
        .split("\n")
        .map((n) => n.trim().toLowerCase())
        .filter((n) => /^[a-z]{3,10}$/.test(n)),
    ),
  ];

  const maleRaw = await fetchText(
    "https://raw.githubusercontent.com/arineng/arincli/master/lib/male-first-names.txt",
  );
  const femaleRaw = await fetchText(
    "https://raw.githubusercontent.com/arineng/arincli/master/lib/female-first-names.txt",
  );

  const maleNames = clean(maleRaw);
  const femaleNames = clean(femaleRaw);

  writeFileSync(join(dataDir, "english/male.txt"), maleNames.join("\n"), "utf8");
  writeFileSync(join(dataDir, "english/female.txt"), femaleNames.join("\n"), "utf8");
  console.log(`  ✓ english/male.txt   (${maleNames.length} names)`);
  console.log(`  ✓ english/female.txt (${femaleNames.length} names)`);
} catch (e) {
  console.error("  ✗ English first names failed:", (e as Error).message);
}

console.log("Fetching English surnames (smashew/NameDatabases)…");
try {
  const text = await fetchText(
    "https://raw.githubusercontent.com/smashew/NameDatabases/master/NamesDatabases/surnames/us.txt",
  );
  const all = text
    .split("\n")
    .map((n) => n.trim().toLowerCase())
    .filter((n) => /^[a-z]{3,12}$/.test(n));

  writeFileSync(join(dataDir, "english/last-names.txt"), [...new Set(all)].join("\n"), "utf8");
  console.log(`  ✓ english/last-names.txt (${all.length} names)`);
} catch (e) {
  console.error("  ✗ English surnames failed:", (e as Error).message);
}

console.log("\nDone. Run `pnpm train` to regenerate Markov models.");
