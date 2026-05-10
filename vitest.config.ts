import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generators/data/index.ts", "src/generators/index.ts", "src/generators/schema/index.ts"],
      reporter: ["text", "html"],
    },
  },
});
