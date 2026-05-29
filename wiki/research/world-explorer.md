# World Explorer — Concept Brainstorm

> Concept doc only (no code). Captures the mental model, the provenance data model the
> lib would need, the view metaphors, and a phased path. Grounded in the actual `src/`
> internals.

## Context

`zod4-mock` grows a whole **deterministic universe** from one seed: records, their
realistic field values, and the relation picks that wire them together. Today that
universe is *invisible* — you call `.generate()` and get a blob of JSON. You can't see
*why* a field got its value, *which* record a foreign key actually points at, or *how
much* of the data is realistic (key-based) vs raw fallback (schema-based).

The goal: a **World Explorer** that makes the universe walkable — show the records, show
*how each value was generated*, and show *how records relate* — intuitively.

## What the library exposes today (and the gaps)

**Already there:**
- `world.explain(schema)` → `ExplainResult` (`src/explain.ts`, `src/types.ts:294`). Tells
  you, per *schema*, which of the 7 pipeline rungs *would* fire per field + a human reason.
  But it's **static, per-schema, PRNG-neutral, shallow** — not per-record, not "what
  actually fired."
- `world.registry.all(schema)` (`src/registry.ts`) → every stored record, insertion order.
- The internal `FieldResolution` tagged union (`src/pipeline.ts:68`) already names *how* a
  field was decided: `override | matcher | keymap | absent | default | custom-gen |
  key-based | schema-based`. **This is the heart of provenance — it exists but is thrown
  away after generation.**

**The gaps (what makes an explorer interesting, and is NOT captured):**
1. **Stable record IDs** — `reg0#3`, `dreg1#2` are computed internally for PRNG seeding
   (`src/world.ts:1125+`) but never exposed.
2. **Relation edges** — `ctx.related("post")` picks a record transiently and discards the
   choice. No "Activity#2.postId → Post#5" is ever recorded.
3. **Actual per-record resolution** — which rung *really* fired for *this* record's field
   (a matcher may conditionally fall through).
4. **Sibling dependencies** — matchers read `ctx.current.firstName`; that causal link
   isn't recorded.
5. **Override-vs-generated** — merged values are indistinguishable from generated ones.
6. **Seed/fork-key trail** — recoverable in principle (`fnv1a(worldSeed:recordId:field)`)
   but not surfaced.

## The enabling idea: `world.trace()` → a `WorldTrace` data structure

One foundational concept unlocks every view: have the world **record provenance as it
generates**, then expose it as a plain, serializable structure. Sketch:

```ts
interface WorldTrace {
  seed: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
}
interface TraceNode {
  id: string;            // exposed stable id: "person#1"
  type: string;          // schema/registration name
  index: number;         // deterministic birth order
  value: unknown;        // the record
  derivedFrom?: string;  // source node id (populateFrom / derived schemas)
  store: boolean;        // store:false ephemerals shown ghosted
  fields: TraceField[];
}
interface TraceField {
  path: string;                  // "address.street"
  value: unknown;
  resolution: FieldResolution["kind"];  // reuse the existing union!
  generator: string;             // "person.firstName"  (already in explain)
  reason: string;                // "exact key: firstname" (already in explain)
  forkKey: string;               // "person#1 ▸ firstName"
  overridden: boolean;
  dependsOn: string[];           // sibling paths read via ctx.current
}
interface TraceEdge {
  from: string; fromField: string;   // Activity#2 . postId
  to: string;                        // Post#5
  relation: string;                  // "post"
  kind: "one" | "many";
  poolSize: number; pickedIndex: number;  // "5 of 8"
}
```

Note how much is **already computed** — `FieldResolution.kind`, the `explain` generator +
reason strings, the internal record IDs. The work is mostly *capturing* it instead of
discarding it (a thin provenance sink threaded through `generateObjectFields` /
`walkPipeline` / `ctx.related`), behind an opt-in flag so the hot path stays clean.

## View metaphors

Three linked views over one `WorldTrace`. Think "dev-tools for a generated universe."

### 1. The Constellation — *how records relate*
A graph. Records are nodes, **clustered by SubjectType** into labelled galaxies
(all `Person`s in one cluster, `Post`s in another). Relation picks are **directed edges**.
- Edge labels carry their own provenance: click `Activity#2 → Post#5` and see
  *"picked 5 of 8 candidates via `fork('rel:post')`"*. Determinism made visible.
- `related.many` fans out as multiple edges from one field.
- Derived records (`populateFrom`) draw a faint **lineage edge** back to their source — a
  different visual channel from relation edges.
- `store:false` ephemerals appear as **ghost nodes** (dashed) so you see what was made and
  discarded.

### 2. The Record Inspector — *how each value was generated*
Select a node → a field-by-field card. Each field gets a **provenance chip** colored by its
`resolution` rung:
- `matcher` / `keymap` (you wired it) · `key-based` (realistic heuristic) ·
  `schema-based` (raw fallback) · `override` (pinned fixture) · `default`/`absent`
  (the dice rolled a wrapper).
- **Absent optionals are shown, greyed** — you see the coin flips that *didn't* land, not
  just the survivors.
- Hover a value → the **seed trail**: `worldSeed → person#1 → fork("firstName")` answers
  *"why is this Alice?"*.
- Sibling causality drawn as little arrows: `suffix` ← `firstName` (gender inferred).

### 3. The Provenance Heatmap — *data-quality at a glance*
A grid: rows = records, columns = fields, cells colored by resolution rung. Instantly read
the **realism ratio** — a wall of "key-based" green = rich data; lots of "schema-based"
grey = fields falling through to raw fallback (a prompt to add a key heuristic or matcher).
This ties directly to the project's better-gen *data-quality* axis (`wiki/vision.md`).

### Cross-cutting delight
- **Seed as DNA.** The seed is front-and-center; nudge it and the whole constellation
  reshuffles. "Same seed = same universe" stops being a doc claim and becomes a toy.
- **Seed diff.** Render two seeds side by side; highlight which records/fields changed —
  visceral proof that per-field seeding (`src/prng.ts`) isolates changes.
- **Replay.** A scrubber walks birth order; press play and watch the universe assemble in
  the deterministic sequence the engine actually used.

## Use cases

The unifying thread: the registry holds the *what*; the value is exposing the *why* and
the *connections*. Every use case is a different lens on the same provenance/trace data.

**Test authoring (primary).** Used live while writing a test, not over a pre-built world.
You import your *real* schemas (or your `world.ts` setup) and call `world.explore()` —
same world your tests use, provenance layer on. It tells you what's safe to assert
(`key-based` = realistic & stable) vs what's noise (`schema-based` = random, will flake),
which records are actually wired together (real foreign keys), and the full accounting of
a `populate` / `populateFrom` fixture before you write a single assertion.

**Debugging.** "Why is this field garbage?" → see it fell through to `schema-based`
because `usrEmail` missed the `email` heuristic. Reproduce a CI failure by punching in its
seed and inspecting the exact world that test saw.

**Schema authoring.** Coverage audit (% realistic vs fallback per schema → where matchers
pay off); relation sanity (did declared foreign keys actually wire up, or dangle?).

**Demo / seeding.** Show a designer/PM the fake company + its employees + invoices as a
graph, not JSON; flip seeds until the world "looks right," then pin it.

**Library dogfooding.** Diff two traces across lib versions to see which fields changed
(serves the better-gen data-quality axis); maintainers' view of which key patterns fire.

**Teaching.** Living documentation of the resolution pipeline — a newcomer watches
*override → matcher → key-based → schema-based* play out on a real field.

**Cross-API consistency.** Show one `Person` powering 3 different response payloads —
verifying the consistency the media-library scenario promises.

## Relational-shape validation

Zod — and therefore zod4-mock — describes a single record's shape: a **tree**. It
fundamentally cannot express **cross-record graph properties**: cardinality (each
`Customer` has 1–5 `Order`s), totality (no `Order` without a `Customer`), acyclicity
(`reportsTo` has no cycles), reachability, degree bounds, set-wide uniqueness. This is
exactly the class of thing maintained by hand today (e.g. a colleague's Neo4j test
fixtures), because there's no schema language for it.

The `WorldTrace.edges` list **is a graph** — so the trace becomes the substrate for a
relational-invariant layer that sits *above* any single schema:
- **Verify.** Declare graph invariants and check them against the generated edge list →
  turns "is my fixture graph correct?" into a checkable spec.
- **Bridge Neo4j both ways.** Export the trace as Cypher / GraphML to seed or diff against
  hand-maintained fixtures; or encode the colleague's invariants as checks and run them on
  zod4-mock output to see if the generator can stand in for the hand-built graph.

**Honest boundary:** zod4-mock *generates*, it does not *constraint-solve*. Relational
invariants are **verified post-hoc**, not declaratively guaranteed. The trace gives you a
place to *check* the properties Zod can't *declare*. Invariant *declaration* belongs in a
thin companion that consumes the trace — not in core.

## Relations: reference vs compositional, and where the solver line is

The brainstorm surfaced that "relations" is really **two different arrows**:

1. **Reference relations (exist today)** — `ctx.related("customer")` picks an *existing*
   record from the registry pool. Bottom-up; the edge is "which existing record I point
   at." Trace edge kind: **pick**.
2. **Compositional relations (the cardinality idea)** — "an Order *has* ≥3 Items, exactly
   1 Customer; that Customer *has* 1 Address." Top-down; generating the parent *causes*
   and *owns* the subtree. Trace edge kind: **owned/lineage**. Sketch:

   ```ts
   world.withSchema(OrderSchema, {
     contains: {
       items:    { schema: ItemSchema, count: { min: 3 } },
       customer: { schema: CustomerSchema, count: 1 },
     },
   });
   // world.generate(OrderSchema) builds the whole subtree by construction.
   ```

**Key boundary — owned cardinality is satisfiable *by construction*.** "≥3 items" needs no
solver: generate 3 and link them. A knob (`own` vs `pick`) is the seam between the two
arrows: fresh child vs draw from a shared pool.

**What a solver does that construction cannot** — construction is *local & forward-only*;
a solver is *global & can backtrack*. You only need one when a decision can't be made in
isolation:
- **mutual/cyclic refs** (A and B reference each other),
- **global coverage/uniqueness** ("every item appears in some order"),
- **exact aggregates** ("3 line items sum to €100"; "transactions net to zero"),
- **feasibility detection** ("30 distinct items from a pool of 5" is impossible),
- **negative/exclusion** ("no two people in a household share a first name").

**The tiers (cheap → expensive):**
- **Construction** — owned trees, cardinality, computed consistency. ~80% of real needs.
- **Rejection sampling** — generate-and-retry for loose constraints. *Probably not needed.*
- **Real solver (CSP/SMT)** — mutual + global + exact aggregates. NP-hard; fights core's
  determinism guarantees. **Plugin-only, if ever.**

**Current lean:** construction is likely *sufficient* — and for the cases it doesn't
cover, `world.generate()` with `overrides`/`populate` factories already lets you
hand-construct the exact world you need.

## North star: a plugin ecosystem around the trace

**Core does one thing — schema → deterministic realistic data — and as a byproduct exposes
a provenance `trace()`.** Everything else is a plugin/companion that consumes the trace;
core never depends on them.

- **Explorer plugin** — the visual/HTML views (constellation, inspector, heatmap).
- **Invariant/graph plugin** — post-hoc relational checks + Neo4j bridge (Cypher/GraphML).
- **Shape-profile / "rooted in reality" plugin** — the most ambitious. Motivated by the
  ING anonymized-but-structurally-realistic dataset: same families, same transaction
  patterns, same relational topology — identity destroyed, structure preserved.
  - The hard part isn't anonymizing; it's staying *structurally faithful* while being
    non-re-identifiable.
  - Core's input is a schema; the plugin's input is real data. They meet at a **shape
    profile**: relational topology + per-field distributions + cardinalities, *measured*
    from a real dataset, handed to core to bias generation toward measured reality.
  - *Core generates fiction; a profile makes the fiction statistically honest; the trace
    proves the fiction holds together.*

## Recommended form

**A library-native `world.trace()` data API + a zero-dependency self-contained HTML
artifact writer** (`world.writeExplorer("world.html")`).

- The **durable asset is the data**. `WorldTrace` is plain and serializable — reusable by
  any frontend, trivially snapshot-testable, outlives any playground or framework churn.
- The **HTML artifact** embeds trace JSON + a tiny inlined viewer into one file you can
  open, share, or attach to a PR. No dev server, no build, no deps. Works in CI.
- It **composes**: the trace feeds the HTML today, a richer app or CLI tomorrow.

## Phased path

1. **Trace foundation** — `world.trace(): WorldTrace`. Exposed stable record IDs + opt-in
   provenance capture. Reuses `FieldResolution.kind` and `explain` strings; adds relation
   edge sink in `ctx.related`. Pure data, fully unit-testable.
2. **HTML artifact** — `world.writeExplorer(path)`: serialize trace + inline minimal viewer
   (Constellation + Inspector).
3. **Heatmap + seed tools** — provenance heatmap, seed diff, replay scrubber.

## Open questions

- Stable ID **scheme to expose**: keep internal `reg0#3` or present friendly `person#1`
  (needs a display-name source per registration)?
- Provenance capture **always-on vs opt-in flag** (hot-path / bundle-size cost)?
- Should the trace be a **new public API** (→ ADR + Rule + backlog item via `/intake`)?
