import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Inline `twoslash` so a vi.spyOn over its module namespace intercepts the build-time
    // highlighter's import of `createTwoslasher` (B126-R7 warm-reuse probe).
    server: { deps: { inline: ["twoslash"] } },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/generators/data/index.ts",
        "src/generators/index.ts",
        "src/generators/schema/index.ts",
      ],
      reporter: ["text", "html"],
    },
  },
});
