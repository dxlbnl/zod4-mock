# Vision

## What is this project?

`zod4-mock` is a library that generates deterministic, schema-driven mock data from
Zod v4 schemas. The same seed always produces the same data, and field names like
`email`, `firstName`, or `createdAt` automatically yield realistic values — with no
configuration. Schemas can declare relations so IDs stay consistent across multiple API
shapes without manual wiring.

## Why does it exist?

Test fixtures are tedious to hand-write and drift out of sync with their schemas.
General-purpose fakers (e.g. `faker-js`) are non-deterministic by default, large to
bundle, and unaware of the Zod schema that defines the shape. `zod4-mock` derives data
directly from the schema, stays deterministic for reproducible tests, and aims to be
smaller and faster than the alternatives.

## Who is it for?

TypeScript developers using Zod v4 who need realistic, reproducible fixtures — for unit
and integration tests, seeding demos/playgrounds, and keeping mock data consistent
across several API contracts in one codebase.

## What does success look like?

Drop-in `generate(schema)` with zero setup; identical output on every run and machine;
realistic values driven by field names and Zod constraints; and measurably beating
`faker-js` on the three axes tracked in the data-generation research: **runtime speed**,
**bundle size**, and **data quality** (see `wiki/research/`).

## Non-goals

- Not a general-purpose faker decoupled from a schema — generation is Zod-v4-driven.
- Not a persistence/seeding framework or an ORM fixture loader.
- Not a Zod v3 library — it targets Zod v4 internals (`_zod.def`) specifically.
- Not a runtime data-validation tool; it produces data, it does not validate inputs.
