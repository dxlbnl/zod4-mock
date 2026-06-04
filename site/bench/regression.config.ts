import { defineConfig } from "vitest/config";

// B98-R3 scenario 2 — the on-demand alias-bisect config.
//
// `bench/regression.bench.ts` imports the `zod4-mock-v0*` npm aliases. It is
// intentionally NOT picked up by `bench/vitest.config.ts` (whose include glob
// matches only `*.test.ts`) so the default `pnpm --filter=@zod4-mock/site bench`
// stays fast and works on a fresh checkout without the alias symlinks.
//
// To run the alias-bisect explicitly (the spec's B98-R3 scenario 2 opt-in
// command):
//   pnpm --filter=@zod4-mock/site exec vitest --config bench/regression.config.ts --run
export default defineConfig({
  test: {
    include: ["bench/regression.bench.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 30_000,
    pool: "forks",
    reporters: ["verbose"],
  },
});
