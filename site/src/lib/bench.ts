export interface BenchResult {
  avg: number;
  min: number;
  max: number;
  opsPerSec: number;
  coldStart: number;
}

export function measure(fn: () => void, { warmup = 5, runs = 20 } = {}): BenchResult {
  const t0 = performance.now();
  fn();
  const coldStart = performance.now() - t0;

  for (let i = 0; i < warmup; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    fn();
    times.push(performance.now() - s);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  return {
    avg,
    min: Math.min(...times),
    max: Math.max(...times),
    opsPerSec: 1000 / avg,
    coldStart,
  };
}
