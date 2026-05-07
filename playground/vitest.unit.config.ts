import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

// Standalone unit test config — no browser, no Storybook plugin.
// Runs pure TS modules: codegen, schema-builder, state logic.
// Usage: pnpm test:unit:node
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    name: "unit",
    include: ["src/lib/**/*.test.ts"],
    environment: "node",
  },
});
