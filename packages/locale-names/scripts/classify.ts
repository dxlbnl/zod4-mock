/**
 * Classify a mixed-origin name corpus into cultural groups.
 *
 * Pipeline:
 *   1. Rule-based pre-filter — immediately assign names that match obvious
 *      cultural markers (arabic prefixes, turkish suffixes, frisian names, etc.)
 *   2. Character bigram cosine-similarity — compare each remaining name against
 *      reference vectors built from known-pure corpora.
 *   3. Minimum-confidence threshold — discard ambiguous names (very short or
 *      low cosine score) rather than forcing a wrong assignment.
 *
 * Usage:
 *   pnpm --filter @zod4-mock/locale-names tsx scripts/classify.ts \
 *     --input  data/training/dutch/male.txt \
 *     --refs   data/training/arabic/ref-male.txt:arabic,data/training/turkish/ref-male.txt:turkish \
 *     --output data/training          # writes dutch/male.txt, arabic/male.txt, turkish/male.txt
 *     --suffix male
 *
 * Or import programmatically via classifyCorpus().
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyByRule } from "./classify-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NgramVector = Map<string, number>;

export interface ClassifyOptions {
  /** Path to the mixed-origin name list (one name per line). */
  inputPath: string;
  /** Map of origin label → path to pure-origin reference corpus. */
  references: Record<string, string>;
  /** Directory to write per-group output files. Files named <origin>.txt */
  outputDir: string;
  /** Suffix to append to output filenames, e.g. "male" → arabic-male.txt */
  suffix: string;
  /** Minimum cosine similarity to assign a name to any group. Default: 0.1 */
  minConfidence?: number;
}

export interface ClassifyResult {
  /** Names assigned to each cultural origin. */
  groups: Record<string, string[]>;
  /** Names below the confidence threshold (discarded). */
  discarded: string[];
}
// ---------------------------------------------------------------------------
// N-gram cosine similarity classifier
// ---------------------------------------------------------------------------

function buildVector(names: string[], n = 2): NgramVector {
  const counts = new Map<string, number>();
  for (const name of names) {
    for (let i = 0; i <= name.length - n; i++) {
      const gram = name.slice(i, i + n);
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  // L2-normalize
  let magnitude = 0;
  for (const v of counts.values()) magnitude += v * v;
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (const [k, v] of counts) counts.set(k, v / magnitude);
  }
  return counts;
}

function cosineSimilarity(a: NgramVector, b: NgramVector): number {
  let dot = 0;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv !== undefined) dot += v * bv;
  }
  return dot;
}

function classifyByNgram(
  name: string,
  referenceVectors: Record<string, NgramVector>,
): { origin: string; score: number } {
  const v = buildVector([name]);
  let best = "dutch";
  let bestScore = -1;
  for (const [origin, ref] of Object.entries(referenceVectors)) {
    const score = cosineSimilarity(v, ref);
    if (score > bestScore) { bestScore = score; best = origin; }
  }
  return { origin: best, score: bestScore };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function classifyCorpus(opts: ClassifyOptions): ClassifyResult {
  const {
    inputPath,
    references,
    outputDir,
    suffix,
    minConfidence = 0.1,
  } = opts;

  const input = readFileSync(inputPath, "utf8")
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0);

  // Build reference vectors from pure-origin corpora
  const referenceVectors: Record<string, NgramVector> = {};
  for (const [origin, refPath] of Object.entries(references)) {
    const refNames = readFileSync(refPath, "utf8")
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter((l) => /^[a-z]+$/.test(l) && l.length >= 3);
    referenceVectors[origin] = buildVector(refNames);
    console.log(`  Reference vector for "${origin}": ${refNames.length} names`);
  }

  const groups: Record<string, string[]> = {};
  const discarded: string[] = [];

  // Dutch is always a group — names stay in dutch if not classified elsewhere
  groups["dutch"] = [];
  for (const origin of Object.keys(references)) {
    groups[origin] = [];
  }

  let ruleHits = 0;
  let ngramHits = 0;
  let discardedCount = 0;

  for (const name of input) {
    // Step 1: rule-based pre-filter
    const ruleResult = classifyByRule(name);
    if (ruleResult !== null && ruleResult !== "dutch") {
      (groups[ruleResult] ??= []).push(name);
      ruleHits++;
      continue;
    }

    // Step 2: n-gram similarity (only for non-trivial references)
    if (Object.keys(referenceVectors).length > 0) {
      const { origin, score } = classifyByNgram(name, referenceVectors);
      if (score < minConfidence) {
        // Ambiguous — keep in Dutch (better to keep than misclassify)
        groups["dutch"]!.push(name);
        discardedCount++;
        continue;
      }
      if (origin !== "dutch") {
        (groups[origin] ??= []).push(name);
        ngramHits++;
        continue;
      }
    }

    // Not classified as non-Dutch → stays in Dutch
    groups["dutch"]!.push(name);
  }

  console.log(`  Rule-based: ${ruleHits} names classified`);
  console.log(`  N-gram:     ${ngramHits} names classified`);
  console.log(`  Low confidence (kept in dutch): ${discardedCount}`);

  // Write output files
  for (const [origin, names] of Object.entries(groups)) {
    if (names.length === 0) continue;
    mkdirSync(join(outputDir, origin), { recursive: true });
    const outPath = join(outputDir, origin, `${suffix}.txt`);
    writeFileSync(outPath, [...new Set(names)].join("\n"), "utf8");
    console.log(`  ✓ ${origin}/${suffix}.txt  (${names.length} names)`);
  }

  return { groups, discarded };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const input  = get("--input");
  const refsArg = get("--refs");   // "path:label,path:label"
  const output = get("--output");
  const suffix = get("--suffix") ?? "names";

  if (!input || !output) {
    console.error(
      "Usage: tsx scripts/classify.ts --input <file> --output <dir> [--refs ref.txt:label,...] [--suffix <suffix>]",
    );
    process.exit(1);
  }

  const references: Record<string, string> = {};
  if (refsArg) {
    for (const entry of refsArg.split(",")) {
      const [path, label] = entry.split(":");
      if (path && label) references[label] = path;
    }
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(__dirname, "../data/training");

  classifyCorpus({
    inputPath: join(__dirname, "..", input),
    references: Object.fromEntries(
      Object.entries(references).map(([k, v]) => [k, join(__dirname, "..", v)]),
    ),
    outputDir: dataDir,
    suffix,
  });
}
