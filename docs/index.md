# zod4-mock Documentation

---

### [Getting Started](getting-started.md)

Step-by-step from zero setup (`generate(schema)`) through worlds, matchers, relations, and overrides.

### [Concepts](concepts.md)

The mental model: world, schema registration modes, `ctx`, the generation pipeline, registry, and determinism.

### [API Reference](api-reference.md)

Complete reference for every exported function, method, and type.

### [Key-Based Field Heuristics](key-heuristics.md)

The full table of field names that auto-generate realistic values (`email`, `firstName`, `iban`, `vin`, …) and how to override them.

### [Recipes](recipes.md)

Copy-pasteable solutions: ad-hoc generation, invoicing domain, document corpus, multi-API file library, overrides, and more.

### [Zod v4 Schema Coverage](zod4-schema-coverage.md)

Which Zod v4 schema types and validators are supported for mock data generation.

### [Better Data Generation](../wiki/research/overview.md)

Design notes and status tracking for the generator overhaul — localization, Markov chains, PRNG improvements, batching, and more. Most pillars are implemented; see [tracking.md](../wiki/research/tracking.md) for the live status. This research now lives in the project wiki under `wiki/research/`.
