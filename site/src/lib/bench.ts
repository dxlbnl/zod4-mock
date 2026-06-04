export interface BenchResult {
  avg: number;
  min: number;
  max: number;
  opsPerSec: number;
  coldStart: number;
  runs: number;
}

export interface MeasureOpts {
  warmup?: number;
  budgetMs: number;
  maxRuns?: number;
}

export function measure(fn: () => void, opts: MeasureOpts): BenchResult {
  const warmup = opts.warmup ?? 5;
  const budgetMs = opts.budgetMs;
  const maxRuns = opts.maxRuns ?? 1_000_000;

  // Cold-start: a single pre-warmup call, byte-equivalent to today (B71-R6).
  const t0 = performance.now();
  fn();
  const coldStart = performance.now() - t0;

  for (let i = 0; i < warmup; i++) fn();

  // Budget loop (B71-R1 / B71-R2): keep calling `fn` until cumulative elapsed
  // crosses `budgetMs`, but never more than `maxRuns` iterations.
  const times: number[] = [];
  const start = performance.now();
  let iters = 0;
  while (iters < maxRuns) {
    const s = performance.now();
    fn();
    times.push(performance.now() - s);
    iters++;
    if (performance.now() - start >= budgetMs) break;
  }

  let total = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const t of times) {
    total += t;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const runs = times.length;
  const avg = total / runs;
  return {
    avg,
    min,
    max,
    opsPerSec: 1000 / avg,
    coldStart,
    runs,
  };
}
