---
"zod4-mock": patch
---

Fix `TypeError: Cannot destructure property 'source' of 'pairs[idx]'` thrown from `world.generate(DerivedSchema, { store: false })` when called with no `source` override and an empty `from:` registry. The auto-provisioned source is now captured locally and not written to the registry under `store: false`, honouring B10-R4's transitive suppression.

(closes #21)
