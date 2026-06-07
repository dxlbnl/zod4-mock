/**
 * Unit tests for B85 — `world.trace()` API + `WorldTrace` public types (stub).
 *
 * Spec: wiki/specs/B85-world-trace-api-and-types.md
 *
 * B85 establishes only the PUBLIC SURFACE of the World Explorer's provenance
 * data API — the `world.trace(): WorldTrace` method, the `trace?: boolean`
 * opt-in flag on `WorldOptions`, and the five public types `WorldTrace` /
 * `TraceNode` / `TraceField` / `TraceEdge` / `TraceResolution`. It is an
 * intentional STUB: nodes are the registry projection (record value + stable
 * registration-order id), but `fields` is always `[]` (field capture is B86)
 * and `edges` is always `[]` (edge capture is B87).
 *
 * RED expectation (stub/types absent):
 *   - `src/trace.ts`, the five types, the `trace()` method on `World`, and
 *     `WorldOptions.trace` do NOT exist yet.
 *   - The behavioural tests (R1–R8) RED at RUNTIME: `world.trace` is
 *     `undefined`, so calling it throws "world.trace is not a function".
 *     (esbuild strips the type-only imports, so the file still runs.)
 *   - The type-level tests (R9 / R11 / R12) are verified by `pnpm typecheck`:
 *     today the `import type { WorldTrace, ... } from "../../../src/index.js"`
 *     fails (the symbols don't exist), so `tsc --noEmit` is the RED signal for
 *     the type-shape requirements. Once the stub lands, the only remaining
 *     `tsc` error is the single deliberate `@ts-expect-error` (R11), which the
 *     implementer leaves in place.
 *
 * `../../../src/index.js` is the package's public entry point — the same module
 * the published `"zod4-mock"` specifier resolves to. The repo's other tests
 * import the public API via this relative path; this file follows that idiom.
 *
 * Strict typing: no `any`, all relative imports use `.js` extensions.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
// These five type imports do NOT resolve until B85 lands — they are the RED
// signal for the type-shape requirements (R9 / R11 / R12) under `pnpm typecheck`.
import type {
  WorldTrace,
  TraceNode,
  TraceField,
  TraceEdge,
  TraceResolution,
} from "../../../src/index.js";
import type { FieldExplanation } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// A schema with a string, a number, and a nested object — exercises the
// JSON round-trip (R8) and gives several fields for the empty-fields stub (R6).
const ItemSchema = z.object({
  id: z.string(),
  count: z.number().int(),
  meta: z.object({ label: z.string() }),
});

// A bare primary schema for the node-per-record / id-scheme scenarios.
const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// ---------------------------------------------------------------------------
// B85-R1: `world.trace()` exists on `World` and returns a WorldTrace
// ---------------------------------------------------------------------------

describe("world-trace — B85-R1 / method exists and returns a WorldTrace", () => {
  it("B85-R1 / happy-path — returns an object with exactly seed/nodes/edges", () => {
    const world = createWorld({ seed: 1 }).withSchema(ItemSchema);
    world.generate(ItemSchema);

    // RED today: `world.trace` is undefined → "world.trace is not a function".
    const trace = world.trace();

    expect(Object.keys(trace).sort()).toEqual(["edges", "nodes", "seed"]);
    expect(typeof trace.seed).toBe("number");
    expect(Array.isArray(trace.nodes)).toBe(true);
    expect(Array.isArray(trace.edges)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B85-R2: trace.seed echoes the world's root seed
// ---------------------------------------------------------------------------

describe("world-trace — B85-R2 / seed echoed", () => {
  it("B85-R2 / seed echoed — trace.seed === 7 for createWorld({ seed: 7 })", () => {
    const world = createWorld({ seed: 7 }).withSchema(PersonSchema);

    const trace = world.trace();

    expect(trace.seed).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// B85-R3: one node per stored registry record, in insertion order
// ---------------------------------------------------------------------------

describe("world-trace — B85-R3 / node per stored record", () => {
  it("B85-R3 / node per record — 3 nodes mirror registry.all in order, store=true, fields=[]", () => {
    const world = createWorld({ seed: 1 }).withSchema(PersonSchema);
    world.populate(PersonSchema, 3);

    const trace = world.trace();
    const stored = world.registry.all(PersonSchema);

    expect(trace.nodes).toHaveLength(3);
    trace.nodes.forEach((node, i) => {
      expect(node.index).toBe(i);
      expect(node.value).toEqual(stored[i]);
      expect(node.store).toBe(true);
      expect(node.fields).toEqual([]);
    });
  });

  it("B85-R3 / empty world — nodes and edges are both []", () => {
    const world = createWorld({ seed: 1 }).withSchema(PersonSchema);

    const trace = world.trace();

    expect(trace.nodes).toEqual([]);
    expect(trace.edges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B85-R4: stable registration-order node id scheme
// ---------------------------------------------------------------------------

describe("world-trace — B85-R4 / id shape and stability", () => {
  it("B85-R4 / id shape + stability — node<regId>#<index>, identical across two worlds", () => {
    const buildWorld = () => {
      const world = createWorld({ seed: 1 }).withSchema(PersonSchema);
      world.populate(PersonSchema, 2);
      return world;
    };

    const traceA = buildWorld().trace();
    const traceB = buildWorld().trace();

    expect(traceA.nodes[0]!.id).toBe("node0#0");
    expect(traceA.nodes[1]!.id).toBe("node0#1");
    expect(traceA.nodes[0]!.type).toBe("node0");

    const idsA = traceA.nodes.map((n) => n.id);
    const idsB = traceB.nodes.map((n) => n.id);
    expect(idsB).toEqual(idsA);
  });
});

// ---------------------------------------------------------------------------
// B85-R5: derived nodes carry derivedFrom; primary nodes omit it
// ---------------------------------------------------------------------------

describe("world-trace — B85-R5 / derived lineage and primary omission", () => {
  it("B85-R5 / derivedFrom — primary node omits it, derived node points at source node id", () => {
    // A primary `P` registered first (regId 0) and a derived `D` (regId 1).
    const ProfileSchema = z.object({ id: z.string() });
    const world = createWorld({ seed: 1 })
      .withSchema(PersonSchema)
      .withSchema(ProfileSchema, {
        from: PersonSchema,
        matchers: { id: (ctx) => (ctx.source as { id: string }).id },
      });

    world.populate(PersonSchema, 1);
    world.populateFrom(ProfileSchema, PersonSchema);

    const trace = world.trace();

    const personNode = trace.nodes.find((n) => n.type === "node0");
    const profileNode = trace.nodes.find((n) => n.type === "derived1");
    expect(personNode).toBeDefined();
    expect(profileNode).toBeDefined();

    // Primary record's node MUST NOT carry an own `derivedFrom` property.
    expect("derivedFrom" in personNode!).toBe(false);
    // Derived record's node's `derivedFrom` equals the source node's id.
    expect(profileNode!.derivedFrom).toBe(personNode!.id);
  });
});

// ---------------------------------------------------------------------------
// B85-R6: empty fields + edges at the stub, even with trace: true
// ---------------------------------------------------------------------------

describe("world-trace — B85-R6 / stub emits empty provenance even with trace enabled", () => {
  it("B85-R6 / empty provenance — trace.edges === [] and every node.fields === []", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(ItemSchema);
    world.generate(ItemSchema);

    const trace = world.trace();

    expect(trace.edges).toEqual([]);
    expect(trace.nodes.length).toBeGreaterThan(0);
    for (const node of trace.nodes) {
      expect(node.fields).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// B85-R7: `trace?: boolean` opt-in flag on createWorld; default ≡ enabled at stub
// ---------------------------------------------------------------------------

describe("world-trace — B85-R7 / flag accepted, default and enabled agree at the stub", () => {
  it("B85-R7 / flag accepted — no-flag and trace:true worlds deep-equal", () => {
    // `createWorld({ trace: true })` must compile (WorldOptions.trace exists) —
    // RED at typecheck today; RED at runtime via the trace() calls regardless.
    const noFlag = createWorld({ seed: 1 }).withSchema(ItemSchema);
    noFlag.generate(ItemSchema);

    const enabled = createWorld({ seed: 1, trace: true }).withSchema(ItemSchema);
    enabled.generate(ItemSchema);

    expect(enabled.trace()).toEqual(noFlag.trace());
  });
});

// ---------------------------------------------------------------------------
// B85-R8: WorldTrace is JSON-serializable end-to-end
// ---------------------------------------------------------------------------

describe("world-trace — B85-R8 / JSON round-trip is lossless", () => {
  it("B85-R8 / JSON round-trip — JSON.parse(JSON.stringify(trace)) deep-equals trace", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(ItemSchema);
    world.populate(ItemSchema, 2);

    const trace = world.trace();
    const roundTripped = JSON.parse(JSON.stringify(trace)) as WorldTrace;

    expect(roundTripped).toEqual(trace);
  });
});

// ---------------------------------------------------------------------------
// B85-R9: five public types exported from the entry point, shaped per spec
//
// Type-only consumer. Verified by `pnpm typecheck` — no runtime assertion is
// possible for a pure type contract. The annotations below must compile once
// the five types land with the specified field shapes.
// ---------------------------------------------------------------------------

describe("world-trace — B85-R9 / five public types exported and shaped", () => {
  it("B85-R9 / type-only consumer compiles (verified by pnpm typecheck)", () => {
    const trace: WorldTrace = { seed: 1, nodes: [], edges: [] };

    const node: TraceNode = {
      id: "node0#0",
      type: "node0",
      index: 0,
      value: { any: "thing" },
      derivedFrom: "node1#0",
      store: true,
      fields: [],
    };

    const field: TraceField = {
      path: "user.email",
      value: "a@b.com",
      resolution: "schema-based",
      generator: "person.firstName",
      reason: "schema-based fallback",
      forkKey: "email",
      overridden: false,
      dependsOn: [],
    };

    const edge: TraceEdge = {
      from: "node0#0",
      fromField: "ownerId",
      to: "node1#0",
      relation: "owner",
      kind: "one",
      poolSize: 3,
      pickedIndex: 1,
    };

    const resolution: TraceResolution = "schema-based";

    // Touch the values at runtime so the bindings are observed (the real
    // assertion is that this file type-checks).
    expect(trace.seed).toBe(1);
    expect(node.type).toBe("node0");
    expect(field.resolution).toBe("schema-based");
    expect(edge.kind).toBe("one");
    expect(resolution).toBe("schema-based");
  });
});

// ---------------------------------------------------------------------------
// B85-R11: TraceField.resolution is the public TraceResolution union, decoupled
// from the internal FieldResolution["kind"].
//
// Verified by `pnpm typecheck`: a valid member compiles, an out-of-union string
// is rejected. The `@ts-expect-error` flips the polarity — the suite passes
// only while `resolution` is the closed `TraceResolution` union (not `string`).
// ---------------------------------------------------------------------------

describe("world-trace — B85-R11 / resolution is the closed TraceResolution union", () => {
  it("B85-R11 / member accepted, arbitrary string rejected (verified by pnpm typecheck)", () => {
    const ok: TraceResolution = "schema-based";

    // @ts-expect-error — "not-a-rung" is not a member of the TraceResolution
    // union. If `resolution`/`TraceResolution` were widened to `string`, this
    // line would compile and the unused-directive error would fail typecheck.
    const bad: TraceResolution = "not-a-rung";

    expect(ok).toBe("schema-based");
    expect(bad).toBe("not-a-rung");
  });
});

// ---------------------------------------------------------------------------
// B85-R12: TraceField shares explain()'s generator/reason provenance contract
// (TraceField extends FieldExplanation). Verified by `pnpm typecheck`.
// ---------------------------------------------------------------------------

describe("world-trace — B85-R12 / TraceField is assignable to FieldExplanation", () => {
  it("B85-R12 / TraceField satisfies FieldExplanation's generator/reason shape", () => {
    const tf: TraceField = {
      path: "user.email",
      value: "a@b.com",
      resolution: "matcher",
      generator: "matcher:email",
      reason: "user matcher",
      forkKey: "email",
      overridden: true,
      dependsOn: ["user.firstName"],
    };

    // Assignable to FieldExplanation — the two share one generator/reason shape.
    const fe: FieldExplanation = tf;

    expect(fe.generator).toBe("matcher:email");
    expect(fe.reason).toBe("user matcher");
  });
});
