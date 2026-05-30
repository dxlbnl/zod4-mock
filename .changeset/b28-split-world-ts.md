---
"zod4-mock": patch
---

Internal refactor — split the 1202-LOC monolithic `src/world.ts` into a `src/world/` subdirectory grouped by concern:

- `src/world/engine.ts` — `WorldImpl` class (the per-field pipeline, array / derived / primary generation, relation methods, B36 generator binding, B39 stable schema slot machinery).
- `src/world/registration.ts` — pure registration types + helpers (`SchemaReg`, `SchemaMode`, `normalizeRelationEntry`, `findPrimaryRegs` / `findDerivedRegs` / `resolveMode`).
- `src/world/derived.ts` — B8 derived-upsert map type + access helpers.
- `src/world/relations.ts` — pure cache-key / fork-key / error-message helpers backing the relation methods.
- `src/world/index.ts` — barrel re-exporting `createWorld` + `WorldImpl`.

`src/world.ts` remains as a thin re-export shim so existing internal imports (`./world.js`) resolve byte-identically. **The public API surface is unchanged** — no consumer-visible diff. No behavior change; full 1041-test suite passes byte-identically.
