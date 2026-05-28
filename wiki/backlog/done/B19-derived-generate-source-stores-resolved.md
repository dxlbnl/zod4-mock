---
id: B19
title: BUG — `world.generate(derivedSchema, { source })` does not store (RESOLVED by B8 in 0.7.0)
type: bug
priority: low
flags: [cancelled]
created: 2026-05-28
---

## Description
User reported (against 0.6.1) that `world.generate(DerivedSchema, { source: record })`
returns a value but does not persist to the registry — asymmetric vs primary schemas
where `generate` does store. The natural setup pattern was silently broken:

```ts
for (const file of world.registry.filter(FileSchema, (f) => f.dataType === 'AUDIO')) {
  world.generate(AudioDetailsSchema, { source: file });
  //   ↑ returned but NOT stored
}
world.registry.count(AudioDetailsSchema);  // 0
```

(GitHub issue #20.)

## Resolution

**Fixed by B8 in 0.7.0** (commit `948bd71`). B8's identity-preserving derivation adds
a per-`(DerivedSchema, source)` upsert that stores the derived record in the registry
on the first call, then returns the same instance on subsequent calls with the same
source. `world.generate(DerivedSchema, { source })` now stores by default. The B8
spec pins this with the `world.registry.count(DerivedSchema) === 1` scenario
(B8-R1) — same shape as issue #20's repro.

The user's "Proposed fix A" (make derived `generate({source})` store by default) is
exactly what B8 shipped. B8 went further by adding identity-preserving idempotence
on top.

## Action required

This card is a **tracking marker** — no further code change is needed. To close the
GitHub issue:

- **Option 1 (recommended)**: post a comment on issue #20 noting "Fixed by B8 in
  0.7.0 (commit `948bd71`)" and close on GitHub. Via the REST API (no `gh` CLI):
  ```bash
  curl -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/dxlbnl/zod4-mock/issues/20/comments \
    -d '{"body":"Fixed by [B8](../commit/948bd71) shipped in 0.7.0."}'
  curl -X PATCH \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/dxlbnl/zod4-mock/issues/20 \
    -d '{"state":"closed"}'
  ```
- **Option 2**: include `(closes #20)` in the next pushed commit to this repo; GitHub
  will auto-close.

Once closed on GitHub, move this card to `done/` with `flags: [cancelled]` (or remove
it entirely — it's bookkeeping).

## Notes
- `flags: [cancelled]` — tracking marker, no code change. Implementation already shipped
  in B8 (commit `948bd71`, 0.7.0). Closed via `(closes #20)` on the cancel commit; GitHub
  auto-closes on next push.
- No spec, no test, no implementer dispatch needed.
- No changeset (already covered by B8's changeset).
