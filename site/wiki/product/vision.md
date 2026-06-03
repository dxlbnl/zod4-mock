# zod4-mock Vision

> Sources: gen-bench design.md, 2026-05-13; gen-bench comparison.md, 2026-05-13; bench/results/latest.json, 2026-05-13
> Raw: [Design Doc](../../raw/product/2026-05-13-design-doc.md); [Comparison Doc](../../raw/product/2026-05-13-comparison-doc.md); [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)

## Overview

`zod4-mock` is a schema-driven mock data generator for **Zod v4**. You hand it a schema and it returns a value of the inferred type — no factory functions to write, no manual field mapping, no separate generator-per-shape. Its differentiator is **relational fidelity**: given a multi-entity schema graph, it produces data where IDs cross-reference real entities (`order.userId` resolves to an actual `User`), which neither `@faker-js/faker` nor `@anatine/zod-mock` can do.

## What it is

- One function: `generate(schema, opts?)` returns `z.infer<typeof schema>`.
- Optional `seed` for deterministic output.
- Works on top of Zod v4 (`zod@^4`), with full coverage of the type system (object, array, union, discriminated union, refine — partial — enum, optional, nullable, record, date, primitives).
- Distributed as `zod4-mock` on npm.

## Why it exists

`@anatine/zod-mock` exists for Zod v3 and works well there, but Zod v4 reworked internals enough that `@anatine/zod-mock` cannot follow without major changes. Meanwhile, the Zod v4 ecosystem needs a schema-driven mocker for the same reasons it needed one in v3:

- **Test fixtures** that automatically track schema changes.
- **Seed data** for demo and dev environments.
- **Storybook / playground** content that matches the production type contract.
- **Relational graphs** — an e-commerce world, a CRM, a content management system — where the value of mock data lives in its referential consistency, not in the realism of any single field.

## Three claims under test

The site (gen-bench) was built to demonstrate three claims:

1. **Speed vs zod-mock.** zod4-mock generates data faster than `@anatine/zod-mock` per call.
2. **Relational fidelity.** zod4-mock produces referentially consistent data; faker requires you to wire IDs by hand.
3. **Type-safe output.** zod4-mock's return type is `z.infer<typeof schema>`, no casts needed.

Claim 1 is supported by the CLI benchmark (see [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)):

- Simple tier: zod4-mock 166k ops/s vs zod3-mock 32k ops/s (~5.2×).
- User tier: 100k vs 20k ops/s (~5.0×).
- Nested tier: 28k vs 10k ops/s (~2.7×).

Claims 2 and 3 are structural facts demonstrated on `/showcase` and verifiable from the type signature of `generate`.

## Honest framing of "fast"

zod4-mock is _not_ universally faster than hand-coded `faker`. On the same `latest.json` snapshot:

| Tier   | zod4-mock ops/s | faker ops/s | Winner    |
| ------ | --------------- | ----------- | --------- |
| simple | 166 136         | 123 230     | zod4-mock |
| user   | 99 516          | 140 406     | faker     |
| nested | 28 333          | 56 871      | faker     |

This is the right tradeoff: faker wins per-call because it does the minimum work — no schema parsing, no constraint checking, no relational bookkeeping. zod4-mock buys back the time it spends with three things faker can't give you: a schema-derived shape (you write `z.object({...})` once, not the generator), type-safe output (you don't `as User` anything), and relational consistency (`order.userId` resolves).

The honest claim, used by [Differentiators](differentiators.md) and reflected in the doc-level `comparison.md`, is:

> **Faster than the only other schema-driven option**, and **competitive with hand-coded faker — with zero shape maintenance.**

Avoid "fastest" or "faster than the alternatives" framing. See [site/known-issues](../site/known-issues.md) item #5 for where this overclaim still lives.

## Versioning note

`zod4-mock` is at `0.2.3` as of this writing. Pre-1.0. APIs may shift. This matters for the site because the entire purpose of the showcase is to measure it — a minor bump can move the numbers materially. See [site/known-issues](../site/known-issues.md) item #11.

## See Also

- [Differentiators](differentiators.md) — competitor framing and the relational wedge.
- [Audience](audience.md) — who this is for and who it isn't.
- [site/vision](../site/vision.md) — how the site sells this vision.
- [site/benchmark-methodology](../site/benchmark-methodology.md) — how the speed numbers are produced and read.
