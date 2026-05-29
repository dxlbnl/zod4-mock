---
"zod4-mock": patch
---

Promote the per-field generation pipeline to a `PIPELINE` list of named
`PipelineStep` functions returning a `FieldResolution` tagged union (eight
`kind` variants). `WorldImpl.generateObjectFields`, `explainSchema`, and
`generateZodObject` (via the `PIPELINE_NO_REGISTRATION` subset) now all walk
the same list — three drift-prone implementations collapsed to one canonical
source of truth.

Internal refactor; behaviour-neutral. PRNG fork keys and the B12 deep-merge
contract are preserved byte-identically (every existing seeded test stays
green without assertion updates), and `world.explain(schema)` output is
byte-identical to pre-B23. The cleanup payoff: `src/explain.ts` shrinks by
~150 LOC (its `decideField` and pattern/identifier helpers fold into the
pipeline steps' dry-run branches), and `generateObjectFields`'s method body
drops from 118 LOC to under 50.

Unblocks B37 (pipeline-numbering doc reconciliation).
