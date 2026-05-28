---
id: B9
title: Doc: pipeline comment in `world.d.ts` omits the eager-overrides step
type: feature
priority: low
flags: []
mode: lite
created: 2026-05-28
---

## Description
The module-level doc-comment in `world.d.ts` (sourced from `src/world.ts`) lists the
field-generation pipeline as steps 1–6, with `options.overrides` at step 5 (final
deep-merge). The comment is silent about the **eager step 0** in
`generateObjectFields` that assigns primitive/array overrides into `result[key]` before
the matcher branch runs, which is why later sibling matchers can read overridden values
via `ctx.current.<sibling>`. A reader concludes (incorrectly) that overrides apply
*after* matchers and avoids an "override drives dependent matcher" pattern that in fact
works correctly. (GitHub issue #9.)

## Acceptance
Update the pipeline doc-comment in `src/world.ts` (and any mirror in `src/types.ts`) to
include step 0:

```
0. options.overrides — eager per-field assignment. Primitive/array overrides land in
   ctx.current before sibling matchers run, so matchers can read them via
   ctx.current.<sibling>.
1. Matchers registered via withSchema
2. Per-schema key maps registered via withKeyMap
3. Key-based generators (field name heuristics)
4. Schema-based generator (Zod type introspection)
5. options.overrides — final deep-merge (covers nested-object overrides that step 0
   didn't eagerly consume)
6. options.transform function
```

Zero behaviour change. No new tests needed — this is a doc-comment-only update.

## Notes
- `mode: lite` — trivial, behavior-neutral product change: single comment in a source
  file, no API/schema change, no new behavior to assert.
- If `docs/api-reference.md` or `docs/concepts.md` repeats the pipeline list, update
  there too in the same step.
