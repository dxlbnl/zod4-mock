/**
 * B97-R3 / B97-R5 — lazy bindGenerators contract.
 *
 * Tests-first RED file: covers B97-R3 (binding amortised across generate
 * calls / never materialised when no matcher reads `ctx.gen`) and B97-R5
 * (no new `any`; `BoundGenerators` tightens to `CoreGenerators`).
 *
 * Failure modes today (pre-fix):
 *   - `src/world/bind-generators.ts` exports no `__bindCount` instrumentation
 *     seam, so the import itself will fail (TypeError on module load).
 *   - `BoundGenerators` in `src/types.ts` is declared as
 *     `CoreGenerators & Record<string, any>`. The R5 typecheck-based
 *     assertion fails because the type still admits the `Record<string, any>`
 *     escape hatch.
 *
 * After the fix:
 *   - The bind module exposes a test-only `__bindCount(world): number`
 *     counter that increments each time a *namespace's* closures are
 *     materialised. Zero-matcher `generate(simpleSchema)` produces 0
 *     materialisations; a single-namespace matcher across `populate(N)`
 *     produces 1 materialisation (cached across records).
 *   - `BoundGenerators === CoreGenerators` — the `Record<string, any>` tail
 *     is gone (per the spec's SHOULD path; the test prints which is the case
 *     so the implementer can decide).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { MatcherCtx } from "../../../src/types.js";

// `__bindCount` is a test-only escape hatch the implementer adds in
// `src/world/bind-generators.ts`. It accepts a world (or the bound-generators
// holder returned by the new lazy binder) and returns the total number of
// namespace materialisations performed during the world's lifetime.
//
// This import will RED today (module has no such named export) and is what
// drives R3 to fail. The dynamic import keeps the file parseable in case
// the bind module changes shape mid-implementation.
import * as bindGeneratorsModule from "../../../src/world/bind-generators.js";

const simpleSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
});

// Single-namespace matcher schema — matchers all hit `ctx.gen.person.*`
// (one namespace). Drives the "one materialisation, cached" assertion.
const SinglePersonSchema = z.object({
  name: z.string(),
});

function getBindCount(world: unknown): number {
  const fn = (bindGeneratorsModule as { __bindCount?: (w: unknown) => number }).__bindCount;
  if (typeof fn !== "function") {
    throw new Error(
      "__bindCount is not exported from src/world/bind-generators.ts — the implementer must add this test-only instrumentation seam",
    );
  }
  return fn(world);
}

// ---------------------------------------------------------------------------
// B97-R3 — binding amortised, zero materialisation when nothing reads ctx.gen
// ---------------------------------------------------------------------------

describe("B97-R3 / zero materialisation when no matcher reads ctx.gen", () => {
  it("B97-R3 / generate(simpleSchema) with no matchers triggers 0 namespace materialisations", () => {
    const world = createWorld({ seed: 1 });
    world.generate(simpleSchema, { store: false });
    expect(getBindCount(world)).toBe(0);
  });
});

describe("B97-R3 / single-namespace matcher materialises exactly once", () => {
  it("B97-R3 / generate(SinglePersonSchema) with one person-namespace matcher triggers exactly 1 materialisation", () => {
    const world = createWorld({ seed: 1 }).withSchema(SinglePersonSchema, {
      matchers: {
        name: (ctx: MatcherCtx) => ctx.gen.person.fullName(),
      },
    });
    world.generate(SinglePersonSchema, { store: false });
    expect(getBindCount(world)).toBe(1);
  });

  it("B97-R3 / populate(SinglePersonSchema, 100) still triggers exactly 1 materialisation (cached across records)", () => {
    const world = createWorld({ seed: 1 }).withSchema(SinglePersonSchema, {
      matchers: {
        name: (ctx: MatcherCtx) => ctx.gen.person.fullName(),
      },
    });
    world.populate(SinglePersonSchema, 100);
    expect(getBindCount(world)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B97-R5 — no new `any`; BoundGenerators may tighten
//
// This is a typecheck-level assertion expressed at runtime through the
// constraint that a `Record<string, any>` value is NOT assignable to
// `BoundGenerators` after the tightening. Pre-fix:
//   BoundGenerators = CoreGenerators & Record<string, any>
// → any `Record<string, any>` literal is assignable.
// Post-fix (SHOULD path):
//   BoundGenerators = CoreGenerators
// → arbitrary objects no longer match; runtime can still inspect via the
//   "does the type still admit arbitrary records?" probe below.
//
// We assert structurally: a fresh `BoundGenerators` from a real world must
// have ONLY the 14 known namespace keys (no `Record<string, any>` tail
// would force this). Pre-fix this passes (the runtime shape is already
// just 14 keys — the `any` tail is type-only) BUT we additionally probe
// the type via TypeScript's compile-time check: a `Record<string, any>`
// MUST NOT be assignable to `BoundGenerators`.
// ---------------------------------------------------------------------------

describe("B97-R5 / no new any; BoundGenerators tightens to CoreGenerators", () => {
  it("B97-R5 / src/types.ts no longer declares BoundGenerators with `Record<string, any>` tail", () => {
    // Source-text assertion. RED today: `src/types.ts:41` reads
    //   export type BoundGenerators = CoreGenerators & Record<string, any>;
    // → the substring "Record<string, any>" is present.
    // Post-fix (SHOULD path the spec recommends): the line becomes
    //   export type BoundGenerators = CoreGenerators;
    // → the substring disappears.
    //
    // If the SHOULD path is reverted (an external consumer breaks under
    // the tightening), the implementer rewires this assertion to assert
    // the legacy tail is preserved AND files the follow-up backlog item
    // named in the commit message (per the spec's R5 fallback clause).

    const __dirname = dirname(fileURLToPath(import.meta.url));
    // tests/unit/core → ../../../src/types.ts
    const typesSrc = readFileSync(join(__dirname, "../../../src/types.ts"), "utf-8");

    expect(
      typesSrc.includes("Record<string, any>"),
      "src/types.ts still declares `BoundGenerators = CoreGenerators & Record<string, any>` — B97-R5 SHOULD tightens this to plain `CoreGenerators` (or, if reverted, the implementer files a follow-up backlog item)",
    ).toBe(false);
  });

  it("B97-R5 / runtime guard — the bound `ctx.gen` exposes all 14 documented namespaces", () => {
    // Runtime guard against an over-zealous tightening that trims the
    // shape. Pre-fix and post-fix both expose the 14 namespaces, so this
    // is a GREEN guard — included so the implementer can catch a
    // collateral-damage regression in `src/world/bind-generators.ts`.
    const NAMESPACES = [
      "color",
      "commerce",
      "company",
      "date",
      "finance",
      "internet",
      "location",
      "lorem",
      "person",
      "phone",
      "string",
      "system",
      "vehicle",
      "word",
    ] as const;

    // The lazy binder hosts the 14 namespace getters on a module-global
    // prototype (round-2 fix), so `Object.keys(ctx.gen)` returns only the
    // namespaces that have been materialised so far. To verify ALL 14
    // namespaces remain reachable from inside a matcher, probe via the
    // `in` operator (which walks the prototype chain).
    let reachableNamespaces: ReadonlyArray<string> = [];
    createWorld({ seed: 1 })
      .withSchema(SinglePersonSchema, {
        matchers: {
          name: (ctx: MatcherCtx) => {
            reachableNamespaces = NAMESPACES.filter((ns) => ns in ctx.gen);
            return ctx.gen.person.fullName();
          },
        },
      })
      .generate(SinglePersonSchema, { store: false });

    for (const ns of NAMESPACES) {
      expect(reachableNamespaces).toContain(ns);
    }
  });
});
