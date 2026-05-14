import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@zod4-mock/locale-core", "@zod4-mock/locale-names"],
});
