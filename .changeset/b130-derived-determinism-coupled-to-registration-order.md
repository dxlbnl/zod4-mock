---
"zod4-mock": minor
---

Fix: `from:`-derived records are now order-independent of unrelated prior registrations.

The field-PRNG seed for a `from:`-derived schema was keyed on the schema's
**registration ordinal** (`regId`), so inserting or reordering any unrelated
`withSchema(...)` call **before** a derived schema silently shifted every field
that schema generated — even though the derived schema, its source, and the
world seed were all identical. This violated the binding determinism rule
(D4/D10): "call order across distinct schemas MUST NOT affect any value." The
derived path is now keyed on the module-global schema **reference identity**
(`getSchemaId`), matching the fix B39 already shipped for the ad-hoc / array /
outer-wrapper paths.

**One-time value shift.** Because the derived field-PRNG seed changes shape
(from `regId`-based to reference-identity-based), the specific generated values
for existing derived schemas shift **once** to the new order-independent
sequence. Consumers who snapshot derived output re-pin once. This mirrors the
analogous one-time determinism-sequence change B39 shipped, hence the `minor`
bump under the 0.x convention.

**Unchanged surfaces.** B8 per-pair upsert idempotence and identity contract,
`unique` / `sourceKey` / `store: false`, `populate` / `populateFrom`, the
`#<sourceIndex>` suffix semantics, and the registered-**primary** path (which is
intentionally still `regId`-keyed per B39-R9) are all unaffected.
