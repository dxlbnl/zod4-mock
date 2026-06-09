---
"zod4-mock": minor
---

`world.trace()` now captures per-field provenance under the `createWorld({ trace: true })` gate — each `TraceField` carries its `resolution` rung, `generator`/`reason`, friendly `forkKey`, `overridden`, and the sibling `dependsOn` keys a matcher read; absent optionals are recorded as `resolution: "absent"` / `value: undefined` and omitted from the record.
