---
"zod4-mock": patch
---

Docs-only — reconcile pipeline-numbering drift across `docs/concepts.md`, `src/world/engine.ts` module-level JSDoc, `CLAUDE.md`, and `wiki/codebase-map.md`. `src/pipeline.ts`'s `PIPELINE` list is the executable contract; all audience-facing locations now inline the full canonical seven-step list (0–6) plus the two wrapping passes (override deep-merge, transform), with step names and order byte-identical across the three inline locations. No source behavior changes.
