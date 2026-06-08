import { describe, it, expect } from "vitest";
import * as api from "../../src/index.js";
import * as localeEn from "@zod4-mock/locale-en";
import * as localeNl from "@zod4-mock/locale-nl";
import type { GenerationDefaults, GenerateOptions, WorldOptions } from "../../src/index.js";

// Type-level surface check (B125 base-extract refactor): the barrel re-exports
// `GenerationDefaults` as the shared base, and `GenerateOptions`/`WorldOptions`
// still resolve and structurally include the shared defaults via `extends`. A
// compile error here (e.g. a missing export) fails `pnpm typecheck`.
const _generationDefaults: GenerationDefaults = {};
const _worldOptions: WorldOptions = { seed: 1 };
const _generateOptions: GenerateOptions<{ a: number }> = { seed: 1 };
void _generationDefaults;
void _worldOptions;
void _generateOptions;

describe("public API surface (B129)", () => {
  it("does not export the dropped internal symbols from the zod4-mock barrel", () => {
    expect((api as Record<string, unknown>).generateFromSchema).toBeUndefined();
    expect((api as Record<string, unknown>).generateFromKey).toBeUndefined();
    expect((api as Record<string, unknown>).fieldSeed).toBeUndefined();
    expect((api as Record<string, unknown>).data).toBeUndefined();
    expect((api as Record<string, unknown>).extend).toBeUndefined();
  });

  it("keeps the supported public symbols on the zod4-mock barrel", () => {
    expect(api.generate).toBeDefined();
    expect(api.createWorld).toBeDefined();
    expect(api.createPrng).toBeDefined();
    expect(api.generators).toBeDefined();
    expect(api.DEFAULT_KEY_MAP).toBeDefined();
    expect(api.DEFAULT_KEY_PATTERNS).toBeDefined();
  });

  it("re-exports extend from the locale packages", () => {
    expect(localeEn.extend).toBeDefined();
    expect(localeNl.extend).toBeDefined();
  });
});
