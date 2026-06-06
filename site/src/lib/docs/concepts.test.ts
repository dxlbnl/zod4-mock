/**
 * B104 — typed concept synonym manifest unit test
 * (spec: wiki/specs/B104-docs-pagefind-search-ui.md).
 *
 * Covers B104-R6 scenario 1 ("manifest shape is statically typed"). Asserts the
 * runtime shape of the typed synonym manifest at site/src/lib/docs/concepts.ts:
 * a readonly array of `{ concept: string; synonyms: ReadonlyArray<string> }`,
 * every entry carrying a non-empty `concept` and a non-empty `synonyms` array,
 * and at least one expected synonym group (`matcher` → `field resolver`, the
 * example the spec/card name) present.
 *
 * Compile-time type breaks surface through `pnpm site:check` (this file uses the
 * typed `CONCEPT_SYNONYMS` export + `ConceptSynonyms` type so a wrong shape errors
 * svelte-check on the import line); the runtime asserts below run under
 * `pnpm site:test:unit`.
 *
 * RED until the implementer creates site/src/lib/docs/concepts.ts with the typed
 * synonym export — the import below fails to resolve, so the suite errors with a
 * "Cannot find module ./concepts.js" / unresolved-import failure (feature absent).
 */

import { describe, it, expect } from "vitest";
import { CONCEPT_SYNONYMS, type ConceptSynonyms } from "./concepts.js";

describe("B104-R6 / typed concept synonym manifest shape", () => {
  it("CONCEPT_SYNONYMS is a non-empty array; each entry has a non-empty concept + synonyms", () => {
    expect(Array.isArray(CONCEPT_SYNONYMS)).toBe(true);
    expect(CONCEPT_SYNONYMS.length).toBeGreaterThan(0);

    for (const entry of CONCEPT_SYNONYMS as ConceptSynonyms) {
      expect(typeof entry.concept).toBe("string");
      expect(entry.concept.length).toBeGreaterThan(0);

      expect(Array.isArray(entry.synonyms)).toBe(true);
      expect(
        entry.synonyms.length,
        `concept "${entry.concept}" must list at least one synonym`,
      ).toBeGreaterThan(0);
      for (const synonym of entry.synonyms) {
        expect(typeof synonym).toBe("string");
        expect(synonym.length).toBeGreaterThan(0);
      }
    }
  });

  it("maps the `matcher` concept to a `field resolver` synonym (the spec's example group)", () => {
    const matcher = (CONCEPT_SYNONYMS as ConceptSynonyms).find(
      (entry) => entry.concept === "matcher",
    );
    expect(matcher, "a `matcher` concept entry must exist").toBeDefined();
    const synonyms = (matcher?.synonyms ?? []).map((s) => s.toLowerCase());
    expect(synonyms).toContain("field resolver");
  });
});
