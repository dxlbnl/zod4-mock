/**
 * Unit tests for B88 — friendly `<typeName>#<index>` ids on every `TraceNode`.
 *
 * Spec: wiki/specs/B88-stable-record-ids.md
 *
 * B88 is a DISPLAY/PROJECTION-layer change inside `world.trace()` only: each
 * `TraceNode.id` becomes the human-friendly `` `${typeName}#${index}` `` form
 * (e.g. `"person#1"`, `"order#5"`) instead of the B85 raw registration-order
 * stub (`"node0#0"` / `"derived1#2"`). `typeName` resolves from the registered
 * schema's `.description` (Zod v4 `schema.describe("…")`), else the stable
 * fallback `` `schema${getSchemaId(schema)}` ``. The `<index>` is **1-based**
 * while the numeric `TraceNode.index` field stays 0-based. Generation/PRNG is
 * untouched (R4).
 *
 * RED expectation (feature absent):
 *   - `world.trace()` still emits the B85 stub ids: `nodes[0].id === "node0#0"`,
 *     `type === "node0"`. So every assertion that the id is the friendly
 *     `<typeName>#<index>` form (R1/R2/R3/R5/R6/R7) fails with the stub value.
 *   - Derived nodes' `derivedFrom` is the stub `"node<regId>#<index>"` rather
 *     than the friendly source id (R5).
 *   - The collision auto-disambiguation (R7) is not implemented — both schemas
 *     surface a `node<regId>#…` stub, never `user#1` / `user-2#1`.
 *
 * R4 is a control: generation must be byte-identical with `trace:true` vs
 * `trace:false`. That assertion is expected to PASS today (B88 is display-only,
 * so the engine already doesn't draw extra PRNG for trace) — it is the guard
 * that the friendly-id projection added later does not change values. The
 * accompanying R4 assertion that `node.value` deep-equals `registry.all(...)`
 * exercises the trace projection and is RED only if the stub broke; it is the
 * spec's stated R4 observable.
 *
 * R8 (doc surfaces) has no bespoke runtime test — the reviewer verifies the
 * TSDoc / `docs/api-reference.md` carry the `<typeName>#<index>` format.
 *
 * `../../../src/index.js` is the package's public entry point — the same module
 * the published `"zod4-mock"` specifier resolves to.
 *
 * Strict typing: no `any`, all relative imports use `.js` extensions.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Shared module-scope schemas (D4/D10: schemas are identity anchors and MUST
// be constructed once and reused across worlds for stable ids).
// ---------------------------------------------------------------------------

const Person = z.object({ id: z.string(), name: z.string() }).describe("person");
const Order = z.object({ id: z.string(), total: z.number().int() }).describe("order");

// No `.describe(...)` — exercises the `schema<id>` fallback (R2).
const Undescribed = z.object({ id: z.string() });

// A derived target schema with its own description (R5).
const Account = z.object({ id: z.string() }).describe("account");

// Three distinct primary references that all resolve to the same display
// name "user" — exercises collision auto-disambiguation (R7).
const UserA = z.object({ id: z.string() }).describe("user");
const UserB = z.object({ id: z.string() }).describe("user");
const UserC = z.object({ id: z.string() }).describe("user");

// ---------------------------------------------------------------------------
// B88-R1: friendly `<typeName>#<index>` id replaces the raw stub id
// ---------------------------------------------------------------------------

describe("B88-R1 / friendly id replaces the raw stub id", () => {
  it("B88-R1 / happy-path — nodes[0].id === 'person#1', not 'reg0#0' / 'node0#0'", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(Person);
    world.populate(Person, 1);

    const id = world.trace().nodes[0]!.id;

    // RED today: the B85 stub yields "node0#0".
    expect(id).toBe("person#1");
    expect(id).not.toBe("reg0#0");
    expect(id).not.toBe("node0#0");
  });
});

// ---------------------------------------------------------------------------
// B88-R2: typeName derives from .description, else the `schema<id>` fallback
// ---------------------------------------------------------------------------

describe("B88-R2 / typeName from description, else schema<id> fallback", () => {
  it("B88-R2 / description supplies the name — nodes[5].id === 'order#6'", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(Order);
    world.populate(Order, 6);

    // RED today: the stub yields "node0#5".
    expect(world.trace().nodes[5]!.id).toBe("order#6");
  });

  it("B88-R2 / missing description falls back to a stable schema<id> token, equal across worlds", () => {
    const build = () => {
      const world = createWorld({ seed: 1, trace: true }).withSchema(Undescribed);
      world.populate(Undescribed, 1);
      return world.trace().nodes[0]!.id;
    };

    const idA = build();
    const idB = build();

    // Stable `schema<id>#1` token: of the form `schema<int>`, 1-based index,
    // no `#` before the index separator, never the empty string, and identical
    // across the two independently-built worlds (R2 / R6).
    // RED today: the stub yields "node0#0".
    expect(idA).toMatch(/^schema\d+#1$/);
    expect(idA).toBe(idB);
    expect(idA).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// B88-R3: `<index>` is 1-based; numeric `TraceNode.index` stays 0-based
// ---------------------------------------------------------------------------

describe("B88-R3 / 1-based id index, 0-based numeric index field", () => {
  it("B88-R3 / first record is #1 — ids are person#1..#3, indices are 0..2", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(Person);
    world.populate(Person, 3);

    const nodes = world.trace().nodes;

    // RED today: the stub yields "node0#0" / index 0 (id is wrong, index right).
    expect(nodes[0]!.id).toBe("person#1");
    expect(nodes[1]!.id).toBe("person#2");
    expect(nodes[2]!.id).toBe("person#3");

    // The numeric `index` field stays 0-based (B85-R3 invariant).
    expect(nodes[0]!.index).toBe(0);
    expect(nodes[1]!.index).toBe(1);
    expect(nodes[2]!.index).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// B88-R4: PRNG / determinism untouched (display-layer-only change)
// ---------------------------------------------------------------------------

describe("B88-R4 / friendly-id projection does not change generated values", () => {
  it("B88-R4 / values unchanged — trace:true vs trace:false records are byte-identical", () => {
    const withTrace = createWorld({ seed: 1, trace: true }).withSchema(Person);
    withTrace.populate(Person, 3);

    const withoutTrace = createWorld({ seed: 1, trace: false }).withSchema(Person);
    withoutTrace.populate(Person, 3);

    // Enabling trace MUST NOT consume PRNG or alter any field value.
    expect(withTrace.registry.all(Person)).toEqual(withoutTrace.registry.all(Person));

    // Spec R4 observable: each node.value deep-equals the stored record.
    const nodes = withTrace.trace().nodes;
    const stored = withTrace.registry.all(Person);
    nodes.forEach((node, i) => {
      expect(node.value).toEqual(stored[i]);
    });
  });
});

// ---------------------------------------------------------------------------
// B88-R5: derived node uses the derived schema's name; derivedFrom is the
// friendly source id; primary node omits derivedFrom
// ---------------------------------------------------------------------------

describe("B88-R5 / derived naming + friendly-id lineage", () => {
  it("B88-R5 / derived id uses 'account', derivedFrom is the friendly 'person#1'", () => {
    const world = createWorld({ seed: 1, trace: true })
      .withSchema(Person)
      .withSchema(Account, {
        from: Person,
        matchers: { id: (ctx) => (ctx.source as { id: string }).id },
      });

    world.populate(Person, 1);
    world.populateFrom(Account, Person);

    const trace = world.trace();
    const personNode = trace.nodes.find(
      (n) => n.value && (n.value as { name?: string }).name !== undefined,
    );
    const accountNode = trace.nodes.find((n) => n.derivedFrom !== undefined);

    expect(personNode).toBeDefined();
    expect(accountNode).toBeDefined();

    // Derived node takes the DERIVED schema's name ("account"), not "person".
    // RED today: the stub yields "derived1#0".
    expect(accountNode!.id).toMatch(/^account#\d+$/);
    expect(accountNode!.id.startsWith("person")).toBe(false);

    // derivedFrom is the friendly source id, and the primary omits the key.
    // RED today: the stub yields "node0#0".
    expect(accountNode!.derivedFrom).toBe("person#1");
    const personOnly = trace.nodes.find((n) => n.derivedFrom === undefined)!;
    expect("derivedFrom" in personOnly).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B88-R6: ids are stable across worlds/runs for the same chain + seed
// ---------------------------------------------------------------------------

describe("B88-R6 / id lists are stable across two equivalent worlds", () => {
  it("B88-R6 / identical id lists — person#1..#2 then order#1..#3 in both", () => {
    const build = () => {
      const world = createWorld({ seed: 1, trace: true }).withSchema(Person).withSchema(Order);
      world.populate(Person, 2);
      world.populate(Order, 3);
      return world.trace().nodes.map((n) => n.id);
    };

    const idsA = build();
    const idsB = build();

    // RED today: the stub yields node0#0.. / node1#0.. .
    expect(idsA).toEqual(["person#1", "person#2", "order#1", "order#2", "order#3"]);
    expect(idsB).toEqual(idsA);
  });
});

// ---------------------------------------------------------------------------
// B88-R7: display-name collision auto-disambiguates with a `-N` suffix, no throw
// ---------------------------------------------------------------------------

describe("B88-R7 / display-name collision auto-disambiguates (no throw)", () => {
  it("B88-R7 / two same-named schemas — first keeps 'user#1', second gets 'user-2#1'", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(UserA).withSchema(UserB);
    world.populate(UserA, 1);
    world.populate(UserB, 1);

    // No throw from withSchema or trace.
    const trace = world.trace();

    const idA = trace.nodes.find((n) => n.value === world.registry.all(UserA)[0])!.id;
    const idB = trace.nodes.find((n) => n.value === world.registry.all(UserB)[0])!.id;

    // RED today: the stub yields "node0#0" / "node1#0".
    expect(idA).toBe("user#1");
    expect(idB).toBe("user-2#1");
  });

  it("B88-R7 / a third same-named collision gets '-3'", () => {
    const world = createWorld({ seed: 1, trace: true })
      .withSchema(UserA)
      .withSchema(UserB)
      .withSchema(UserC);
    world.populate(UserA, 1);
    world.populate(UserB, 1);
    world.populate(UserC, 1);

    const trace = world.trace();
    const idC = trace.nodes.find((n) => n.value === world.registry.all(UserC)[0])!.id;

    // RED today: the stub yields "node2#0".
    expect(idC).toBe("user-3#1");
  });

  it("B88-R7 / re-registering the same reference does not advance the suffix", () => {
    const world = createWorld({ seed: 1, trace: true }).withSchema(Person).withSchema(Person); // same reference again (e.g. to add matchers)
    world.populate(Person, 1);

    // No throw, and the bare name (no `-2`) since a reference cannot collide
    // with itself. RED today: the stub yields "node0#0".
    expect(world.trace().nodes[0]!.id).toBe("person#1");
  });
});
