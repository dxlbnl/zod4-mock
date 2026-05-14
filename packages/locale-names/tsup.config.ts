import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "groups/dutch/index": "src/groups/dutch/index.ts",
    "groups/arabic/index": "src/groups/arabic/index.ts",
    "groups/turkish/index": "src/groups/turkish/index.ts",
    "groups/frisian/index": "src/groups/frisian/index.ts",
    "groups/english/index": "src/groups/english/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@zod4-mock/locale-core"],
});
