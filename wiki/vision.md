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
bundle, and unaware of the Zod schema that defines the shape. `@anatine/zod-mock`
exists for Zod v3 but Zod v4 reworked internals enough that it cannot follow without
a major rewrite. `zod4-mock` fills that gap: it derives data directly from the schema,
stays deterministic for reproducible tests, and aims to be smaller and faster than the
alternatives — with relational fidelity as the differentiator.

## Who is it for?

TypeScript developers using Zod v4 who need realistic, reproducible fixtures — for unit
and integration tests, seeding demos/playgrounds, and keeping mock data consistent
across several API contracts in one codebase. Detailed audience analysis (primary +
secondary personas, jobs-to-be-done, anti-personas) lives in `requirements.md`.

## What does success look like?

Drop-in `generate(schema)` with zero setup; identical output on every run and machine;
realistic values driven by field names and Zod constraints; and measurably beating
`@anatine/zod-mock` on every measured tier, while staying competitive with hand-coded
`faker` despite the extra schema-parsing work. See `research/` for the three
data-generation axes (runtime speed, bundle size, data quality).

## Three claims under test

The site (`site/`, formerly `gen-bench`) exists to demonstrate three claims:

1. **Speed vs `@anatine/zod-mock`.** zod4-mock generates data faster per call.
2. **Relational fidelity.** zod4-mock produces referentially consistent multi-entity
   data out of the box; `faker` requires you to wire IDs by hand and `@anatine/zod-mock`
   has no relational layer at all.
3. **Type-safe output.** zod4-mock's return type is `z.infer<typeof schema>`, no casts
   needed.

Claim 1 is supported by the CLI benchmark (`site/bench/results/latest.json`); claims
2 and 3 are structural facts demonstrated on `/showcase` and verifiable from the
type signature of `generate`.

## Differentiators

### Feature matrix

| Feature                       | zod4-mock | @anatine/zod-mock | faker |
| ----------------------------- | --------- | ----------------- | ----- |
| Zod v4 schemas                | ✓         | ✗                 | —     |
| Zod v3 schemas                | ✗         | ✓                 | —     |
| Schema-driven output          | ✓         | ✓                 | ✗     |
| Relational / cross-entity IDs | ✓         | ✗                 | ✗     |
| Type-safe output              | ✓         | ✓                 | ✗     |
| Seeded / deterministic        | ✓         | ✗                 | ✓     |
| No schema required            | ✗         | ✗                 | ✓     |
| Handles `.refine()`           | partial   | ✗                 | —     |
| Handles discriminated unions  | ✓         | partial           | —     |

The relational column is the wedge. Faker can't do relations (no schema layer).
`@anatine/zod-mock` can't do them on v4 (no v4 support, and no relational layer
on v3 either). zod4-mock is the only library that takes a multi-entity Zod v4
schema graph and returns data with consistent cross-entity IDs.

### vs `@anatine/zod-mock`

Same idea as zod4-mock, earlier and for the previous Zod major. Not Zod v4
compatible — its schema introspection reads internals Zod v4 reworked. zod4-mock
ships as the v4 successor with a relational layer added.

### vs `faker-js`

A high-quality random data library with no schema layer. To produce a `User`, you
write the shape by hand alongside your Zod schema — two sources of truth. Faker
wins on raw per-call speed when hand-tuned; it loses on shape maintenance, type
drift, and relational consistency, which it cannot do without bespoke wiring per
relation.

## Honest framing of "fast"

zod4-mock is **not** universally faster than hand-coded `faker`. On any given
benchmark tier, faker can win per-call because it does the minimum work — no
schema parsing, no constraint checking, no relational bookkeeping. zod4-mock buys
back the time it spends with three things faker can't give you: a schema-derived
shape (you write `z.object({...})` once, not the generator), type-safe output
(you don't `as User` anything), and relational consistency
(`order.userId` resolves).

The honest claim is:

> **Faster than the only other schema-driven option**, and **competitive with
> hand-coded faker — with zero shape maintenance.**

Avoid "fastest" or "faster than the alternatives" framing — see `architecture.md`
Rule D20.
