/**
 * Unit tests for B86 — provenance field-capture sink (per-field resolution +
 * sibling reads).
 *
 * Spec: wiki/specs/B86-provenance-field-capture-sink.md
 *
 * B85 shipped `world.trace()` as a stub: every `TraceNode` emits `fields: []`.
 * B86 threads a gated provenance-capture sink through the per-field pipeline so
 * each `TraceField` records HOW its value was decided — `path` / `value` /
 * `resolution` / `generator` / `reason` / `forkKey` / `overridden` / `dependsOn`.
 * Capture is opt-in behind `createWorld({ trace: true })`; off-path
 * (`trace:false`, the default) the sink is a no-op.
 *
 * RED expectation (feature absent):
 *   - The field-capture assertions (R1–R8, R12, R13) are RED today: with
 *     `trace:true`, `world.trace().nodes[i].fields` is still `[]` (the B85
 *     stub), so every "fields has length N / find a TraceField / its resolution
 *     is X" assertion fails because there are no fields to read. R13 is RED
 *     because `generateObjectFields` is 58 LOC today (≥ 50).
 *   - The DETERMINISM CONTROLS stay GREEN even pre-implementation, because the
 *     gate is observation-only and the engine draws no extra PRNG for trace:
 *       * R6's second half (records in `registry.all` deep-equal a `trace:false`
 *         world with the same seed + chain),
 *       * R9's "two worlds' node.value records deep-equal" half,
 *       * R10's testable proxy (the R11 determinism control — the bench scenario
 *         rides `pnpm site:bench`, not the unit suite),
 *       * R11 (trace:true vs trace:false records are byte-identical).
 *     The first halves of R6 and R9 (forkKey composite / non-empty fields) are
 *     the RED field-capture assertions in those same tests.
 *
 * Per the minimal-tests rule: exactly one `it` per requirement id
 * (`B86-R<k> / <scenario>`); no exhaustive enumeration, no extra guard tests.
 *
 * Determinism is keyed on schema REFERENCE identity (D4/D10): every `z.object`
 * fixture is constructed once at module scope and reused across worlds.
 *
 * `../../../src/index.js` is the package's public entry point — the same module
 * the published `"zod4-mock"` specifier resolves to.
 *
 * Strict typing: no `any`, all relative imports use `.js` extensions.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { GeneratorContext, TraceField } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared module-scope schemas (D4/D10).
// ---------------------------------------------------------------------------

// R1: exactly three scalar fields, none optional, fixed shape order a, b, c.
const ThreeField = z.object({ a: z.string(), b: z.string(), c: z.string() });

// R2: a string + a number field.
const NameAge = z.object({ name: z.string(), age: z.number().int() });

// R3: one field per resolution rung. `email` is the heuristic (→ key-based);
// `plain` is a constrained number with no key/heuristic match (→ schema-based);
// `greeting` has a default that is taken (→ default); `tag` resolves via a
// withKeyMap entry (→ keymap); `slug` via a withGenerators entry (→ custom-gen);
// `status` via a withSchema matcher (→ matcher); `kind` via an overrides
// primitive (→ override).
const RungSchema = z.object({
  kind: z.string(),
  status: z.string(),
  tag: z.string(),
  slug: z.string(),
  email: z.string(),
  plain: z.number().int().min(1).max(100),
  greeting: z.string().default("hi"),
});

// R4: an absent optional. `optionalProbability: 0` rolls every optional absent.
const Nickable = z.object({ id: z.string(), nickname: z.string().optional() });

// R5: a heuristic field + a matcher field; trace's generator/reason must equal
// explain()'s for the same fields.
const ExplainParity = z.object({ email: z.string(), status: z.string() });

// R6: a single described schema for the forkKey composite + determinism control.
const Person = z.object({ firstName: z.string() }).describe("person");

// R7: an overridden field + a sibling.
const TitleBody = z.object({ title: z.string(), body: z.string() });

// R8: a matcher reading a sibling via ctx.current.
const DisplayName = z.object({ firstName: z.string(), displayName: z.string() });

// R9: a multi-field schema for the gate / value-equality control.
const Multi = z.object({ name: z.string(), email: z.string(), count: z.number().int() });

// R11: heuristic key + matcher + optional field — the byte-identity control.
const Mixed = z.object({
  email: z.string(),
  status: z.string(),
  nickname: z.string().optional(),
});

// R12: a B8 primary/derived pair for the upsert cache-hit control.
const Source = z.object({ id: z.string() });
const Derived = z.object({ sourceId: z.string(), label: z.string() });

// ---------------------------------------------------------------------------
// B86-R1: each field yields a TraceField on its node (trace enabled)
// ---------------------------------------------------------------------------

describe("B86-R1 / each field yields a TraceField on its node", () => {
  it("B86-R1 / one TraceField per object field", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(ThreeField);
    world.generate(ThreeField);

    // RED today: the B85 stub emits `fields: []`.
    const fields = world.trace().nodes[0]!.fields;

    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.path)).toEqual(["a", "b", "c"]);
    for (const f of fields) {
      // Every entry carries all eight TraceField keys.
      expect(Object.keys(f).sort()).toEqual(
        [
          "dependsOn",
          "forkKey",
          "generator",
          "overridden",
          "path",
          "reason",
          "resolution",
          "value",
        ].sort(),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// B86-R2: TraceField.value equals the field's generated value
// ---------------------------------------------------------------------------

describe("B86-R2 / TraceField.value equals node.value[path]", () => {
  it("B86-R2 / captured value matches the record", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(NameAge);
    world.generate(NameAge);

    const node = world.trace().nodes[0]!;
    const record = node.value as Record<string, unknown>;

    // RED today: `node.fields` is [] so there is nothing to compare.
    expect(node.fields.length).toBeGreaterThan(0);
    for (const f of node.fields) {
      expect(f.value).toEqual(record[f.path]);
    }
  });
});

// ---------------------------------------------------------------------------
// B86-R3: resolution is the public TraceResolution mapped from the internal rung
// ---------------------------------------------------------------------------

describe("B86-R3 / resolution maps each rung to the right TraceResolution", () => {
  it("B86-R3 / each rung maps to the right TraceResolution", () => {
    // `optionalProbability: 1` forces every optional/default wrapper to roll
    // absent (P(absent) = optionalProbability — the established engine
    // semantics, see generate-options-passthrough/world tests), so `greeting`'s
    // `.default("hi")` is deterministically TAKEN (→ "default"). The other six
    // fields carry no wrapper, so the knob does not affect them. (See the
    // flagged-test note in the B86 implementer report: the original `0` relied
    // on the inverted P(present) reading and never landed absent.)
    const world = createWorld({ seed: 1, trace: true, optionalProbability: 1 })
      .withSchema(RungSchema, { matchers: { status: () => "active" } })
      .withKeyMap(RungSchema, { tag: () => "tagged" })
      .withGenerators({ slug: () => "the-slug" });

    // `greeting` has a default; omit it from overrides/matchers so the default
    // is TAKEN (→ "default"). `kind` is forced via an overrides primitive.
    world.generate(RungSchema, { overrides: { kind: "fixed" } });

    const byPath: Record<string, TraceField> = {};
    // RED today: fields is [] so this stays empty and every lookup is undefined.
    for (const f of world.trace().nodes[0]!.fields) byPath[f.path] = f;

    expect(byPath.kind!.resolution).toBe("override");
    expect(byPath.status!.resolution).toBe("matcher");
    expect(byPath.tag!.resolution).toBe("keymap");
    expect(byPath.slug!.resolution).toBe("custom-gen");
    expect(byPath.email!.resolution).toBe("key-based");
    expect(byPath.plain!.resolution).toBe("schema-based");
    expect(byPath.greeting!.resolution).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// B86-R4: absent optionals are recorded with resolution "absent" / value undefined
// ---------------------------------------------------------------------------

describe("B86-R4 / absent optional recorded as absent / undefined", () => {
  it("B86-R4 / absent optional still produces a TraceField", () => {
    // optionalProbability: 1 → the `nickname` optional rolls absent on every
    // record (P(absent) = optionalProbability — the established engine
    // semantics; see the flagged-test note in the B86 implementer report. The
    // original `0` relied on the inverted P(present) reading and never landed
    // absent).
    const world = createWorld({ seed: 1, trace: true, optionalProbability: 1 }).withSchema(
      Nickable,
    );
    world.generate(Nickable);

    const node = world.trace().nodes[0]!;
    // RED today: fields is [] so `nickname` is never found.
    const nickname = node.fields.find((f) => f.path === "nickname");

    expect(nickname).toBeDefined();
    expect(nickname!.resolution).toBe("absent");
    expect(nickname!.value).toBeUndefined();

    // The record itself omits the absent key.
    expect("nickname" in (node.value as Record<string, unknown>)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B86-R5: generator / reason reuse the explain() vocabulary
// ---------------------------------------------------------------------------

describe("B86-R5 / generator+reason agree with explain()", () => {
  it("B86-R5 / trace generator/reason equal explain()'s for the same fields", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(ExplainParity, {
      matchers: { status: () => "active" },
    });
    world.generate(ExplainParity);

    const explained = world.explain(ExplainParity).fields;
    const byPath: Record<string, TraceField> = {};
    // RED today: fields is [] so byPath stays empty and the lookups are undefined.
    for (const f of world.trace().nodes[0]!.fields) byPath[f.path] = f;

    // Equality between trace() and explain() (the spec's one-language contract).
    expect(byPath.email!.generator).toBe(explained.email.generator);
    expect(byPath.email!.reason).toBe(explained.email.reason);
    expect(byPath.status!.generator).toBe(explained.status.generator);
    expect(byPath.status!.reason).toBe(explained.status.reason);

    // Pin the documented literals so a wrong-but-equal vocabulary still fails.
    expect(byPath.email!.generator).toBe("internet.email");
    expect(byPath.status!.generator).toBe("matcher:status");
  });
});

// ---------------------------------------------------------------------------
// B86-R6: forkKey is the friendly `<node id> ▸ <path>` composite + determinism
// ---------------------------------------------------------------------------

describe("B86-R6 / forkKey composite + determinism", () => {
  it("B86-R6 / forkKey is 'person#1 ▸ firstName' and capture adds no PRNG draw", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(Person);
    world.populate(Person, 1);

    const firstName = world.trace().nodes[0]!.fields.find((f) => f.path === "firstName");

    // RED today: fields is [] so `firstName` is undefined.
    expect(firstName).toBeDefined();
    expect(firstName!.forkKey).toBe("person#1 ▸ firstName");

    // DETERMINISM CONTROL (stays GREEN pre-impl): capture must add no PRNG draw
    // and change no generated value vs a trace:false world with the same chain.
    const control = createWorld({ seed: 1, trace: false }).withSchema(Person);
    control.populate(Person, 1);
    expect(world.registry.all(Person)).toEqual(control.registry.all(Person));
  });
});

// ---------------------------------------------------------------------------
// B86-R7: overridden is true exactly when an override merged onto the field
// ---------------------------------------------------------------------------

describe("B86-R7 / overridden reflects the override application", () => {
  it("B86-R7 / overridden true for the overridden field, false for a sibling", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(TitleBody);
    world.generate(TitleBody, { overrides: { title: "Fixed" } });

    const byPath: Record<string, TraceField> = {};
    // RED today: fields is [] so byPath stays empty.
    for (const f of world.trace().nodes[0]!.fields) byPath[f.path] = f;

    expect(byPath.title!.overridden).toBe(true);
    expect(byPath.title!.value).toBe("Fixed");
    expect(byPath.body!.overridden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B86-R8: dependsOn lists sibling field paths a matcher read via ctx.current
// ---------------------------------------------------------------------------

describe("B86-R8 / dependsOn lists sibling reads via ctx.current", () => {
  it("B86-R8 / matcher reading a sibling records the dependency", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(DisplayName, {
      matchers: {
        displayName: (ctx: GeneratorContext) => {
          const current = ctx.current as { firstName?: string };
          return `Hello ${current.firstName ?? ""}`;
        },
      },
    });
    world.generate(DisplayName);

    const byPath: Record<string, TraceField> = {};
    // RED today: fields is [] so byPath stays empty.
    for (const f of world.trace().nodes[0]!.fields) byPath[f.path] = f;

    // displayName read ctx.current.firstName → dependsOn contains "firstName".
    expect(byPath.displayName!.dependsOn).toContain("firstName");
    // firstName read no sibling → empty dependsOn.
    expect(byPath.firstName!.dependsOn).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B86-R9: capture is gated; trace:false is the empty-fields default
// ---------------------------------------------------------------------------

describe("B86-R9 / capture gated; trace:false emits empty fields", () => {
  it("B86-R9 / default world captures no fields, values identical to trace:true", () => {
    const off = createWorld({ seed: 1 }).withSchema(Multi);
    off.generate(Multi);

    const on = createWorld({ seed: 1, trace: true }).withSchema(Multi);
    on.generate(Multi);

    // Default (no flag): every node emits fields: [].
    for (const node of off.trace().nodes) {
      expect(node.fields).toEqual([]);
    }

    // RED today: the trace:true world still emits fields: [] (the B85 stub).
    expect(on.trace().nodes[0]!.fields.length).toBeGreaterThan(0);

    // DETERMINISM CONTROL (stays GREEN pre-impl): the two worlds' records match
    // — the gate changes only capture, never generation.
    const offNodes = off.trace().nodes;
    const onNodes = on.trace().nodes;
    expect(onNodes).toHaveLength(offNodes.length);
    onNodes.forEach((node, i) => {
      expect(node.value).toEqual(offNodes[i]!.value);
    });
  });
});

// ---------------------------------------------------------------------------
// B86-R10: the off-path is a no-op with zero hot-path allocation
//
// The spec's allocation-budget assertion rides the B97/B98 perf+memory suite
// and the bench scenario rides `pnpm site:bench` (not this unit suite). A
// direct per-field allocation assertion in vitest is brittle (GC-dependent), so
// the testable proxy here is the R11 byte-identity determinism control: if the
// off-path were not a no-op (e.g. it consumed PRNG to build TraceFields), the
// trace:false and trace:true records would diverge. This control stays GREEN
// pre-impl and guards the off-path no-op invariant; the allocation budget proper
// is verified by `pnpm test` (perf+memory suite) and `pnpm site:bench`.
// ---------------------------------------------------------------------------

describe("B86-R10 / off-path is a no-op (determinism proxy for allocation budget)", () => {
  it("B86-R10 / trace:false vs trace:true records are byte-identical (off-path no-op)", () => {
    const off = createWorld({ seed: 1 }).withSchema(Mixed);
    off.populate(Mixed, 5);

    const on = createWorld({ seed: 1, trace: true }).withSchema(Mixed);
    on.populate(Mixed, 5);

    // DETERMINISM CONTROL (stays GREEN pre-impl): the off-path draws no extra
    // PRNG and allocates no TraceFields — records match byte-for-byte.
    expect(off.registry.all(Mixed)).toEqual(on.registry.all(Mixed));
  });
});

// ---------------------------------------------------------------------------
// B86-R11: capture is observation — PRNG/counter-neutral (D4/D10)
// ---------------------------------------------------------------------------

describe("B86-R11 / trace:true records are byte-identical to default", () => {
  it("B86-R11 / populate(S,5) records deep-equal between trace:false and trace:true", () => {
    const off = createWorld({ seed: 1, optionalProbability: 0.5 }).withSchema(Mixed, {
      matchers: { status: () => "active" },
    });
    off.populate(Mixed, 5);

    const on = createWorld({ seed: 1, optionalProbability: 0.5, trace: true }).withSchema(Mixed, {
      matchers: { status: () => "active" },
    });
    on.populate(Mixed, 5);

    // DETERMINISM CONTROL (stays GREEN pre-impl): every record deep-equals its
    // counterpart — capture consumed no PRNG draw and advanced no counter.
    expect(on.registry.all(Mixed)).toEqual(off.registry.all(Mixed));
  });
});

// ---------------------------------------------------------------------------
// B86-R12: cache short-circuits fabricate no provenance (D9)
// ---------------------------------------------------------------------------

describe("B86-R12 / B8 upsert cache hit adds no fabricated fields", () => {
  it("B86-R12 / a second derived generate (cache hit) adds no node, no extra fields", () => {
    const world = createWorld({ seed: 1, trace: true })
      .withSchema(Source)
      .withSchema(Derived, {
        from: Source,
        matchers: { sourceId: (ctx) => (ctx.source as { id: string }).id },
      });

    world.populate(Source, 1);
    const src = world.registry.all(Source)[0]!;

    // First derive walks the pipeline and stores; the second is a B8 per-pair
    // upsert cache hit returning the same record (D9 PRNG/counter-neutral).
    const first = world.generate(Derived, { source: src });
    const second = world.generate(Derived, { source: src });
    expect(first).toBe(second);

    const derivedNodes = world.trace().nodes.filter((n) => "derivedFrom" in n);

    // Exactly one D node — the cache hit produced no second record.
    expect(derivedNodes).toHaveLength(1);

    // RED today: its fields were captured ONCE from the single pipeline walk;
    // the stub emits [] (so length is 0, not the field count) — the assertion
    // that fields were captured once (non-empty, one per Derived field) fails.
    const captured = derivedNodes[0]!.fields;
    expect(captured.length).toBe(2);
    expect(captured.map((f) => f.path).sort()).toEqual(["label", "sourceId"]);
  });
});

// ---------------------------------------------------------------------------
// B86-R13: generateObjectFields stays under the B23-R9 body-length guard
// ---------------------------------------------------------------------------

describe("B86-R13 / generateObjectFields body remains < 50 LOC", () => {
  it("B86-R13 / the method body (signature..closing brace) is < 50 lines", async () => {
    // The spec pins:
    //   awk '/private generateObjectFields/,/^  }/' src/world/engine.ts | wc -l
    // RED today: the method is 58 LOC (capture not yet extracted to a helper).
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const enginePath = fileURLToPath(new URL("../../../src/world/engine.ts", import.meta.url));
    const source = await readFile(enginePath, "utf8");
    const lines = source.split("\n");

    const start = lines.findIndex((l) => /private generateObjectFields/.test(l));
    expect(start).toBeGreaterThanOrEqual(0);
    // awk's range ends at the FIRST `^  }` at-or-after the start line.
    let end = -1;
    for (let i = start; i < lines.length; i++) {
      if (/^  }/.test(lines[i]!)) {
        end = i;
        break;
      }
    }
    expect(end).toBeGreaterThanOrEqual(start);

    const bodyLineCount = end - start + 1;
    expect(bodyLineCount).toBeLessThan(50);
  });
});
