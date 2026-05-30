/**
 * Unit tests for B44 — `world.generate(primaryArraySchema, { store: false })`
 * hangs forever (infinite loop) when the rolled `target` exceeds
 * `existingCount`.
 *
 * Written test-first against the spec
 * (wiki/specs/B44-primary-array-store-false-hangs.md). Closes GitHub issue
 * [#26](https://github.com/dxlbnl/zod4-mock/issues/26).
 *
 * Root cause (spec Context): `WorldImpl.generateArray`'s `case "primary"` arm
 * loops `while (this.registry.count(innerSchema) < target)`. Under
 * `store: false`, `generateAndStorePrimary` honours B10-R4 transitive
 * suppression and does NOT write to the registry, so `registry.count` never
 * advances and the loop is unbounded whenever `target > existingCount`. The
 * fix decouples the loop's progress counter from the registry under
 * `!effectiveStore`: generate the rolled `target` records directly via
 * `Array.from(...)` and return that array (B20's "Fix B" local-capture
 * precedent, primary-array analogue).
 *
 * RED-confirmation note: the hang is a synchronous spin-loop, so vitest's
 * per-test `{ timeout: ... }` CANNOT preempt it (vitest runs tests on the
 * same JS event loop and cannot interrupt synchronous code). `vi.useFakeTimers()`
 * likewise does nothing — there is no timer call inside the spin. The correct
 * RED-confirmation harness for this regression is to invoke the test file
 * under shell `timeout`:
 *
 *   timeout 5 pnpm vitest run \
 *     tests/unit/core/primary-array-store-false-hangs.test.ts --reporter=verbose
 *
 * Exit code 124 = the shell killed the runner = the hang is real. After the
 * fix lands, the file runs to completion and all four tests pass.
 *
 * Scope (tight 4-test subset of the spec's 10 requirements — the remaining
 * six are redundant with existing coverage, composition pins for items not
 * yet shipped, or reviewer-only changeset/docs items):
 *
 *  - B44-R1: hang regression — exact #26 repro returns with the rolled
 *    length in `[1, 5]`, every record's `name === "x"` (the matcher's
 *    observable proof). HANGS today.
 *  - B44-R3: registry not mutated under `store: false` — direct extension
 *    of B10-R2 / B10-R4 to the primary-array dispatcher arm. HANGS today
 *    (the test never reaches its registry assertion because B44-R1's hang
 *    fires first).
 *  - B44-R5: store-on regression guard — the working branch (default
 *    `store: true`) stays correct. PASSES today; pins the fix doesn't break
 *    the working branch.
 *  - B44-R7: derived inner under `store: false` — the `case "derived"`
 *    branch is independent of B44's fix; pin it doesn't regress.
 *    PASSES today.
 *
 * NOT tested here (reasons inline):
 *  - B44-R2: "same generation path" already covered by B44-R1's matcher
 *    + name assertion (every record's `name === "x"`).
 *  - B44-R4: rolled-target arithmetic is an internal-PRNG-position pin
 *    already covered by B39's per-schema slot tests and B44-R5's store-on
 *    regression guard (same arithmetic).
 *  - B44-R6: ad-hoc branch already returns under `store: false` today
 *    (covered by B10-R2 / B10-R4 existing tests in
 *    `tests/unit/core/generate-store-opt-out.test.ts`).
 *  - B44-R8: composition pins with B38 / B43 already live in their own
 *    suites; B44 inherits them by construction (B38/B43 throws fire
 *    before B44's new branch is reached).
 *  - B44-R9 / B44-R10: changeset + docs are reviewer-only artifacts.
 *
 * Schemas are module-scoped per D4 / D10 (architecture Rules — determinism
 * keyed on schema reference identity; reusing the same module-scoped
 * references exercises the per-schema slot model from B39). One
 * `createWorld(...)` per test — no shared worlds.
 *
 * No `any`, no casts (architecture Rules D1).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Module-scoped fixtures (D4 / D10 — per-schema slot keyed on identity).
// ---------------------------------------------------------------------------

// #26 repro shape: plain `z.object({ id, name })`, matcher on `name` is the
// load-bearing observable proof in B44-R1 that the same generation path
// ran for every record returned under `store: false`.
const Schema = z.object({ id: z.string(), name: z.string() });

// Derived-pair fixtures for B44-R7.
const ProductSchema = z.object({ id: z.uuid() });
const OrderSchema = z.object({ productId: z.uuid() });

// ---------------------------------------------------------------------------
// B44-R1: hang regression — exact #26 repro returns with the rolled length
// ---------------------------------------------------------------------------

describe("B44-R1: store:false primary-array returns with rolled length", () => {
  it("B44-R1 / exact #26 repro returns with length in [1, 5] and matcher applied to every record", () => {
    // Exact #26 repro from the spec's Context section.
    const world = createWorld({ seed: 1 });
    world.withSchema(Schema, { matchers: { name: () => "x" } });

    // RED today: this call hangs (the primary-mode
    // `while (registry.count(inner) < target)` loop never advances under
    // `store: false` because `generateAndStorePrimary` does not write).
    // Vitest per-test timeouts cannot preempt this synchronous spin —
    // use shell `timeout 5 pnpm vitest run <file>` for RED confirmation.
    // Post-fix: returns near-instantly with the rolled length.
    const result = world.generate(Schema.array(), { store: false });

    // Strict length assertion (spec B44-R1: default `defaultArrayLength`
    // falls back to [1, 5] via `resolveMinRequired` / `resolveMaxAllowed`).
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(5);

    // Matcher contract from #26 — every record's `name === "x"` (the
    // practical proof the matcher pipeline ran on every returned record).
    // Also catches a regression that "returns quickly with wrong records".
    for (const r of result) {
      expect(r.name).toBe("x");
    }
  });
});

// ---------------------------------------------------------------------------
// B44-R3: registry not mutated under `store: false`
// ---------------------------------------------------------------------------

describe("B44-R3: registry not mutated by store:false primary-array call", () => {
  it("B44-R3 / fresh-world store:false array call leaves the registry empty", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Schema, { matchers: { name: () => "x" } });

    // RED today: hang — the assertion below never runs because the call
    // never returns. Use shell `timeout` to bound the RED run.
    world.generate(Schema.array(), { store: false });

    // B10-R2 / B10-R4 invariant: no registry write at the top-level or
    // transitively. The freshly-generated records exist only as the
    // returned array, not in the registry.
    expect(world.registry.count(Schema)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B44-R5: store-on path regression guard (the working branch)
// ---------------------------------------------------------------------------

describe("B44-R5: store-on primary-array path regression guard", () => {
  it("B44-R5 / store-on primary-array call stores all rolled records and returns the registry", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(Schema, { matchers: { name: () => "x" } });

    // Default `store: true` — the working branch today (no hang).
    const result = world.generate(Schema.array());

    // Non-empty (rolled `target >= 1` for default `defaultArrayLength`).
    expect(result.length).toBeGreaterThan(0);

    // D8: stored equals returned for registered schemas. Pins that the
    // fix's `if (!this.effectiveStore)` branch does NOT execute on the
    // store-on path (otherwise the registry would not match the returned
    // array).
    expect(world.registry.count(Schema)).toBe(result.length);
  });
});

// ---------------------------------------------------------------------------
// B44-R7: derived inner schemas under `store: false` are unaffected
// (the `case "derived"` branch is independent of B44's `case "primary"` fix).
// ---------------------------------------------------------------------------

describe("B44-R7: derived inner schema under store:false unaffected", () => {
  it("B44-R7 / derived array under store:false produces an array, no derived write", () => {
    const world = createWorld({ seed: 1 });
    world.withSchema(ProductSchema);
    world.withSchema(OrderSchema, {
      from: ProductSchema,
      matchers: { productId: (ctx) => ctx.source.id },
    });

    // Auto-provision a few sources via `world.generate(ProductSchema)`
    // (default `store: true` — each call stores one Product). The derived
    // array branch uses these as its source pool.
    world.generate(ProductSchema);
    world.generate(ProductSchema);
    world.generate(ProductSchema);

    const result = world.generate(OrderSchema.array(), { store: false });

    // Derived branch returns an array (one derived output per source).
    expect(Array.isArray(result)).toBe(true);

    // B10-R2: no derived write under `store: false`.
    expect(world.registry.count(OrderSchema)).toBe(0);
  });
});
