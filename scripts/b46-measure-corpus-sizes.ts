/**
 * @file scripts/b46-measure-corpus-sizes.ts
 *
 * B46 measurement spike — read-only sizing of the real wordlist corpora that
 * would replace today's char-level Markov models per the B45 direction.
 *
 * For each newline-delimited corpus under `packages/locale-names/data/training/`,
 * report: raw bytes, sorted-newline bytes, front-coded bytes, gzip bytes (default
 * level), brotli bytes (default quality), line count, mean line length, and the
 * first-letter histogram (used to confirm B42 — the natural list distribution).
 *
 * Pure measurement: no writes back to packages/, no mutation. Run once with:
 *   pnpm tsx scripts/b46-measure-corpus-sizes.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TRAINING_DIR = join(ROOT, "packages/locale-names/data/training");

// ---------------------------------------------------------------------------
// Front-coding (shared-prefix length + suffix bytes).
//
// For a sorted list of words, each line becomes:
//   <varint prefix-length-shared-with-previous> <suffix bytes> \n
//
// We approximate the varint as a single byte (sufficient for word lengths
// commonly < 256, which is always true for names). Final size assumes the
// resulting stream is stored verbatim (no further compression). A real
// implementation would also gzip/brotli the front-coded stream — we report
// brotli(front-coded) as a second number.
// ---------------------------------------------------------------------------

function frontCode(sorted: string[]): Buffer {
  const out: number[] = [];
  let prev = "";
  for (const word of sorted) {
    let shared = 0;
    const max = Math.min(prev.length, word.length, 255);
    while (shared < max && prev.charCodeAt(shared) === word.charCodeAt(shared)) shared++;
    out.push(shared);
    const suffix = word.slice(shared);
    for (let i = 0; i < suffix.length; i++) out.push(suffix.charCodeAt(i));
    out.push(0x0a); // newline as record separator
    prev = word;
  }
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// Read a corpus file and return parsed lines.
// ---------------------------------------------------------------------------

interface Corpus {
  group: string;
  file: string;
  lines: string[];
  rawBytes: number;
}

function loadCorpus(group: string, file: string): Corpus | null {
  const path = join(TRAINING_DIR, group, file);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const rawBytes = statSync(path).size;
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return { group, file, lines, rawBytes };
}

// ---------------------------------------------------------------------------
// First-letter histogram — for B42 confirmation.
//
// Produces a sorted top-letter list and the share of A/B/C/D combined.
// ---------------------------------------------------------------------------

function firstLetterHistogram(lines: string[]): { hist: Record<string, number>; abcdShare: number } {
  const hist: Record<string, number> = {};
  for (const w of lines) {
    const c = (w[0] ?? "").toLowerCase();
    hist[c] = (hist[c] ?? 0) + 1;
  }
  const total = lines.length;
  const abcd = (hist.a ?? 0) + (hist.b ?? 0) + (hist.c ?? 0) + (hist.d ?? 0);
  return { hist, abcdShare: total === 0 ? 0 : abcd / total };
}

// ---------------------------------------------------------------------------
// Size calculation for one corpus.
// ---------------------------------------------------------------------------

interface SizeReport {
  group: string;
  file: string;
  lineCount: number;
  meanLineLen: number;
  rawBytes: number;
  sortedBytes: number;
  frontCodedBytes: number;
  frontCodedBrotliBytes: number;
  gzipBytes: number;
  brotliBytes: number;
  abcdShare: number;
  topLetters: string;
}

function measure(corpus: Corpus): SizeReport {
  const sorted = [...corpus.lines].sort();
  const sortedText = sorted.join("\n") + "\n";
  const sortedBuf = Buffer.from(sortedText, "utf8");

  const fc = frontCode(sorted);
  const fcBrotli = brotliCompressSync(fc, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  });
  const gz = gzipSync(sortedBuf, { level: 9 });
  const br = brotliCompressSync(sortedBuf, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  });

  const meanLen =
    corpus.lines.length === 0
      ? 0
      : corpus.lines.reduce((s, l) => s + l.length, 0) / corpus.lines.length;

  const { hist, abcdShare } = firstLetterHistogram(corpus.lines);
  const topLetters = Object.entries(hist)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([c, n]) => `${c}:${((100 * n) / corpus.lines.length).toFixed(1)}%`)
    .join(" ");

  return {
    group: corpus.group,
    file: corpus.file,
    lineCount: corpus.lines.length,
    meanLineLen: Number(meanLen.toFixed(2)),
    rawBytes: corpus.rawBytes,
    sortedBytes: sortedBuf.length,
    frontCodedBytes: fc.length,
    frontCodedBrotliBytes: fcBrotli.length,
    gzipBytes: gz.length,
    brotliBytes: br.length,
    abcdShare: Number((abcdShare * 100).toFixed(1)),
    topLetters,
  };
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

const groups = readdirSync(TRAINING_DIR).filter((g) => {
  try {
    return statSync(join(TRAINING_DIR, g)).isDirectory();
  } catch {
    return false;
  }
});

const reports: SizeReport[] = [];
for (const group of groups) {
  const files = readdirSync(join(TRAINING_DIR, group)).filter((f) => f.endsWith(".txt"));
  for (const file of files) {
    const c = loadCorpus(group, file);
    if (c) reports.push(measure(c));
  }
}

console.log("# B46 corpus measurement — locale-names training corpora\n");
console.log(
  "| group | file | lines | meanLen | raw | sorted | front-coded | fc+brotli | gzip | brotli | A/B/C/D% | top-5 first letters |",
);
console.log(
  "|-------|------|------:|--------:|----:|-------:|------------:|----------:|-----:|-------:|---------:|--------------------:|",
);
for (const r of reports) {
  console.log(
    `| ${r.group} | ${r.file} | ${fmt(r.lineCount)} | ${r.meanLineLen} | ${fmt(r.rawBytes)} | ${fmt(r.sortedBytes)} | ${fmt(r.frontCodedBytes)} | ${fmt(r.frontCodedBrotliBytes)} | ${fmt(r.gzipBytes)} | ${fmt(r.brotliBytes)} | ${r.abcdShare}% | ${r.topLetters} |`,
  );
}

// ---------------------------------------------------------------------------
// Aggregate per-group totals (the spike's "<250 KB per locale" gate).
// ---------------------------------------------------------------------------

const totals = new Map<
  string,
  { raw: number; sorted: number; frontCoded: number; fcBrotli: number; gzip: number; brotli: number }
>();
for (const r of reports) {
  const t = totals.get(r.group) ?? {
    raw: 0,
    sorted: 0,
    frontCoded: 0,
    fcBrotli: 0,
    gzip: 0,
    brotli: 0,
  };
  t.raw += r.rawBytes;
  t.sorted += r.sortedBytes;
  t.frontCoded += r.frontCodedBytes;
  t.fcBrotli += r.frontCodedBrotliBytes;
  t.gzip += r.gzipBytes;
  t.brotli += r.brotliBytes;
  totals.set(r.group, t);
}

console.log("\n## Per-group totals\n");
console.log("| group | raw | front-coded | fc+brotli | gzip | brotli |");
console.log("|-------|----:|------------:|----------:|-----:|-------:|");
for (const [group, t] of totals) {
  console.log(
    `| ${group} | ${fmt(t.raw)} | ${fmt(t.frontCoded)} | ${fmt(t.fcBrotli)} | ${fmt(t.gzip)} | ${fmt(t.brotli)} |`,
  );
}

const grandTotal = [...totals.values()].reduce(
  (acc, t) => ({
    raw: acc.raw + t.raw,
    sorted: acc.sorted + t.sorted,
    frontCoded: acc.frontCoded + t.frontCoded,
    fcBrotli: acc.fcBrotli + t.fcBrotli,
    gzip: acc.gzip + t.gzip,
    brotli: acc.brotli + t.brotli,
  }),
  { raw: 0, sorted: 0, frontCoded: 0, fcBrotli: 0, gzip: 0, brotli: 0 },
);
console.log(
  `\nGRAND TOTAL across locale-names training corpora: raw=${fmt(grandTotal.raw)} front-coded=${fmt(grandTotal.frontCoded)} fc+brotli=${fmt(grandTotal.fcBrotli)} gzip=${fmt(grandTotal.gzip)} brotli=${fmt(grandTotal.brotli)} bytes`,
);
