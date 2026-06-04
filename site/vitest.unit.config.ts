import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.test.ts"],
    // *.types.test.ts files are type-level only: they're picked up by
    // svelte-check (`pnpm site:check`) to assert compile-time props
    // contracts, but contain no runtime describe/it blocks. Exclude them
    // from vitest so they don't fail "No test suite found".
    exclude: ["**/*.types.test.ts", "**/node_modules/**"],
    environment: "node",
  },
});
