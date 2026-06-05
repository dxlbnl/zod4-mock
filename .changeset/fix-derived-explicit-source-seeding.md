---
"zod4-mock": patch
---

**Fix: `world.generate(DerivedSchema, { source })` collapsed all field seeds to one**

The explicit-source derived path (`generateWithSourceOverride`) hardcoded the
record's `sourceIndex` to `0`, so every call built the same record id
(`dreg<regId>#0`) and therefore the same field PRNG seed. Distinct sources
produced records whose field-PRNG-derived fields were **identical** — only
fields pulled straight off `ctx.source` (e.g. `ctx.source.id`) varied. This
broke the common per-source loop:

```ts
for (const file of files) world.generate(audioStatusSchema, { source: file });
// every status shared identical `languages`, `speakerCount`, etc.
```

The field PRNG is now seeded from the **source identity**
(`computeSourceIdentity` → hashed), so distinct sources get distinct field
seeds while staying value-keyed and order-independent (D4/D10), and the B8
upsert short-circuit is preserved (look-alikes with the same `sourceKey` value
still resolve to one record).

This aligns the explicit-source path with the identity-keyed contract that
`wiki/decisions.md` already documents for `dreg{id}#{sourceIndex}`.

**Note:** if you snapshot values generated via `generate(Derived, { source })`,
those values shift once on upgrade — the previous values were the degenerate
all-identical output.
