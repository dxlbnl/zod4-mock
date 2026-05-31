---
id: B20
title: BUG — `world.generate(derivedSchema, { store: false })` crashes when the `from:` registry is empty
type: bug
priority: high
flags: []
created: 2026-05-29
spec: wiki/specs/B20-store-false-empty-from-crash.md
---

## Description

When `world.generate(DerivedSchema, { store: false })` is called with no `source`
override and the `from:` registry is empty, the auto-provisioning path silently fails
to populate the registry (because `effectiveStore` is `false`), `pairs` stays empty,
and the code destructures `pairs[NaN]` → `TypeError: Cannot destructure property
'source' of 'pairs[idx]' as it is undefined.`

Reported as GitHub issue [#21](https://github.com/dxlbnl/zod4-mock/issues/21). High
friction in practice: the natural Phase-2-style "give me one ephemeral derived
fixture" pattern explodes the moment the test runs before any setup helper has
populated the `from:` schema, with an opaque `TypeError` from inside the library.

### Repro (from #21)

```ts
import { z } from "zod";
import { createWorld } from "zod4-mock";

const Source = z.object({ id: z.uuid(), name: z.string() });
const Derived = z.object({ sourceId: z.uuid(), label: z.string() });

const world = createWorld({ seed: 1 });
world.withSchema(Source);
world.withSchema(Derived, {
  from: Source,
  matchers: { sourceId: (ctx) => ctx.source.id },
});

// Empty registry; no source override → must auto-provision.
world.generate(Derived, { store: false });
// → TypeError: Cannot destructure property 'source' of 'pairs[idx]' as it is undefined.
```

Without `store: false` it works (auto-provisions one Source, stores it, picks it).
With `store: false` the auto-provision happens but doesn't store, so the subsequent
`registry.all(Source)` returns `[]` and `pairs` stays empty.

### Root cause

In `src/world.ts` (0.7.1), the no-source derived branch in `generateSingleItem`:

```js
else if (derivedRegs.length > 0) {
  for (const reg of derivedRegs) {
    if (this.registry.count(reg.from) === 0) {
      const fromReg = this.findPrimaryRegs(reg.from)[0] ?? null;
      this.generateAndStorePrimary(reg.from, fromReg);
      // ↑ when effectiveStore === false, this generates but does NOT store
    }
  }
  const pairs = [];
  for (const reg of derivedRegs) {
    const sources = this.registry.all(reg.from);   // still []
    for (let i = 0; i < sources.length; i++) {
      pairs.push({ source: sources[i], reg, sourceIndex: i });
    }
  }
  const idx = (this.generationCounter - 1) % pairs.length;
  // pairs.length === 0 → idx === NaN
  const { source, reg, sourceIndex } = pairs[idx];
  // pairs[NaN] === undefined → CRASH
}
```

The auto-provisioning intent is "make sure there's _something_ to derive from",
but it assumes `generateAndStorePrimary` stores unconditionally. Under
`store: false` (B10 / B10-R2 — propagated `effectiveStore`), it doesn't, so the
assumption breaks.

### Proposed fixes (from #21)

- **A.** Force store on the auto-provisioned source regardless of `effectiveStore`
  (temporarily flip `this.effectiveStore = true` around the auto-provision loop).
  Matches existing intent under default `store: true`.
- **B.** Keep the source ephemeral too — capture the generated record in a local
  `Map<reg, source>` so `pairs` is built off the capture, not a registry read.
  Purer wrt `store: false` semantics (nothing lands in the registry).

(A) is simpler; (B) is stricter about honoring the user's `store: false` opt-out.
spec-writer to decide and pin in the spec.

## Notes

- GitHub issue: [#21](https://github.com/dxlbnl/zod4-mock/issues/21).
- Related: B10 (the `{ store: false }` opt-out that introduced `effectiveStore`), B8
  (per-`(DerivedSchema, source)` upsert).
- Regression test is required (D6 — bug rule).
- Changeset (patch) required per the per-item changeset rule.
