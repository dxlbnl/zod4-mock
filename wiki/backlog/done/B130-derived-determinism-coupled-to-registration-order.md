---
id: B130
title: Derived-record determinism is coupled to registration order, not schema reference identity
type: bug
priority: high
flags: [review]
created: 2026-06-08
spec: wiki/specs/B130-derived-determinism-coupled-to-registration-order.md
---

## Description

A `from:`-derived schema's generated field values are a function of its **registration
order**, not of `(seed, schema reference, source)` as D4/D10 require. Inserting or reordering
any `withSchema(...)` call *before* a derived schema silently changes every field that schema
generates — the transcription strings, sentence arrays, named-entity offsets, etc. — even
though the derived schema, its source, and the seed are all identical.

This violates the binding determinism Rule (D4/D10): "Generation MUST be deterministic per
`(seed + schema reference + per-schema call slot)`; **call order across distinct schemas MUST
NOT affect any value**. Determinism is keyed on schema _reference_ identity (a module-global
`WeakMap`), not structural equality." B39 moved the ad-hoc / array / outer-wrapper fork keys
onto the reference-identity `getSchemaId`, but the **derived** path was never converted — it
still keys on the registration ordinal.

### Mechanism (confirmed in source)

- **`src/world/engine.ts:535`** — `withSchema` assigns `regId: this.schemaRegs.length`, i.e.
  the running registration count. `regId` is therefore the registration *ordinal*.
- **`src/world/engine.ts:1182`** — `generateDerivedRecord` seeds the record's field PRNG from
  `const recordId = `dreg${reg.regId}#${sourceIndex}``. (The lib documents this at ~line 237:
  "seeds the record's field PRNG (`dreg<regId>#<index>`)".)

So a derived record's field PRNG seed depends on `regId`, and `regId` depends on how many
schemas were registered before it. Insert one `withSchema` earlier → every later schema's
`regId` shifts by +1 → `recordId` shifts → field PRNG reseeds → all generated fields change.

### Observed in this repo

`setupRawData` (3rd) registers `artifactServerEvent` `from: fileDataSchema`. `setupTextsuite`
(10th) registers and generates the file-derived schemas (`audioFileStatus`, `documentMetadata`,
`audioSegment`, the sentence schemas, …). Moving `artifactServerEvent` earlier bumps the
`regId` of every schema registered after it, including all the textsuite schemas, so their
generated data drifts and 3 specs break. Removing `artifactServerEvent` fixes them; registering
it *last* (highest `regId`, nothing after it shifts) also fixes them.

### Why the original repro missed it

The first B130 reproduction registered the sibling *after* the generated schema, so its `regId`
never moved and nothing shifted — which made it look like "registration is inert". It is not:
registration assigns `regId` (engine.ts:535) and generation consumes it (engine.ts:1182). The
defect is registration-**order** dependence, and a correct repro must insert a prior
`withSchema` before the derived schema being generated.

### Reproduction (order-based, the correct one)

```ts
import { z } from 'zod';
import { createWorld } from 'zod4-mock';

const Parent = z.object({ id: z.string() });
const Derived = z.object({ pid: z.string(), label: z.string() }); // a non-source field that the PRNG fills

const run = (insertEarlierReg: boolean) => {
  const w = createWorld({ seed: 1 });
  if (insertEarlierReg) {
    // a DIFFERENT, unrelated schema registered BEFORE Derived — only changes Derived's regId
    w.withSchema(z.object({ unrelated: z.string() }));
  }
  w.withSchema(Derived, { from: Parent, matchers: { pid: (c) => c.source.id } });
  w.populate(Parent, 1);
  const [p] = w.registry.all(Parent);
  return JSON.stringify(w.generate(Derived, { source: p }));
};

run(false) === run(true); // false ← expected: true (Derived, its source, and seed are identical)
```

**Expected:** `run(false) === run(true)` — inserting an unrelated earlier registration MUST NOT
change `Derived`'s generated fields.

**Actual:** they differ; `Derived`'s `recordId` (`dreg<regId>#<index>`) shifts because the
earlier registration bumped its `regId`.

### Fix direction

Key the derived `recordId` on schema **reference identity** (the module-global `getSchemaId`,
as B39 did for the other paths) instead of the registration-order `regId`, while preserving the
B8 per-pair upsert contract, the `#<sourceIndex>` suffix, and the no-source/array derived
behaviour. This is a determinism-contract change (values shift once, to the order-independent
sequence) — likely a `minor` bump, and it should be cross-checked against B8/B39/D10 scenarios.

## Notes

- Supersedes the original (confounded) B130 framing, which blamed an un-generated sibling. That
  repro was a fresh-schema-per-call artifact (D4/D10 working as designed); see progress.md
  2026-06-08. The real, order-based defect is captured above.
