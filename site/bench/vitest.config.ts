import { defineConfig } from "vitest/config";

// B98-R3: the default `pnpm --filter=@zod4-mock/site bench` invocation MUST NOT
// pick up the alias-bisect file. That file is named `bench/regression.bench.ts`
// (not `*.test.ts`) precisely so this glob skips it — a fresh contributor
// without the `zod4-mock-v0*` alias `node_modules` symlinks can still run
// `pnpm bench`. The opt-in command for the bisect is documented in
// `wiki/specs/B98-perf-memory-regression-suite.md` (B98-R3 scenario 2).
export default defineConfig({
  test: {
    include: ["bench/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 30_000,
    pool: "forks",
    reporters: ["verbose"],
  },
});
