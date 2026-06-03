# zod4-mock Audience

> Sources: gen-bench design.md, 2026-05-13; gen-bench comparison.md, 2026-05-13; gen-bench getting-started.md, 2026-05-13
> Raw: [Design Doc](../../raw/product/2026-05-13-design-doc.md); [Comparison Doc](../../raw/product/2026-05-13-comparison-doc.md); [Getting Started Doc](../../raw/product/2026-05-13-getting-started-doc.md)

## Overview

Visitors land on the zod4-mock homepage because something in their work suggests they need it. They don't know yet whether zod4-mock is the right tool. The site's job is to answer "is this for me?" in under thirty seconds, then prove it, then get them to install. This article documents who those visitors are and what they're trying to do — so future Claude (and future copywriting) can target them precisely.

## Primary persona

A TypeScript developer — backend, full-stack, or full-stack-ish frontend with API ownership — who:

- Already uses **Zod v4** (or is migrating to it) for runtime validation.
- Needs **mock data** for one of: test fixtures, seed data for dev/demo environments, Storybook stories, playground content, load testing, or API stubbing.
- Has hit one of these specific frictions:
  - Their fixture factories drifted from their schemas.
  - Their faker-based generators produce data that doesn't pass their own Zod validators.
  - They built a multi-entity demo and the cross-references don't resolve.
  - They tried `@anatine/zod-mock` and discovered it doesn't support Zod v4.

The buying signal is usually concrete: someone hit one of those frictions today and is searching for "zod v4 mock data" or "zod mock generator" or arrived from a colleague's recommendation.

## What they're hiring zod4-mock to do

Three jobs, in declining frequency:

1. **"Generate fixtures from my schemas so they stay in sync."** The most common job. Solves the drift problem.
2. **"Give me a realistic relational dataset for my demo / Storybook / load test."** The differentiated job — what the showcase exists to prove zod4-mock can do.
3. **"Replace my hand-rolled faker generators because I already write Zod schemas."** The migration job. Buying signal: "I have schemas, why am I writing the shape twice?"

## What the site funnel needs to deliver

In order of priority for a first-time visitor:

1. **Identification** (~5s on the hero). "This generates Zod v4 mocks. Including relational ones. Faster than zod-mock. Type-safe."
2. **Proof — relational** (~10–20s scroll to or one click). The `/showcase` page or an inlined preview of it. Cross-entity IDs that visibly resolve.
3. **Proof — performance** (optional, ~30s). Links to `/bench`. The kind of visitor who clicks here wants ops/sec; show it honestly.
4. **Onboarding** (one click from hero). `/docs/getting-started` — installation + the inline playground that lets them edit a schema and see output without leaving the page.
5. **Reference** (deeper docs). `/docs/api`, `/docs/relational`, `/docs/comparison` for the visitors evaluating against a specific use case.

The P1 pass (2026-05-16) restructured `/` to deliver this funnel: Install CTA above the fold, inline relational exhibit in the primary scroll path, feature matrix below.

## Anti-personas (who should _not_ use zod4-mock, and what to use instead)

- **No schemas, just need random data.** Use `faker` directly. zod4-mock has nothing to offer without a schema.
- **Locked on Zod v3 with no upgrade path.** Use `@anatine/zod-mock`. zod4-mock doesn't support v3.
- **Need server-side mock APIs with full HTTP layer simulation.** Use MSW or similar; zod4-mock is a data layer, not a network layer.
- **Need data that passes complex business invariants** (e.g., "order total = sum of item subtotals to the cent"). zod4-mock can generate the fields but won't satisfy arbitrary cross-field invariants. Pair it with a post-generation fixer if you need this.

## Secondary persona — the comparison shopper

Some visitors arrive because they're comparing libraries for a team decision. They typically:

- Skim the feature matrix on `/` and `/docs/comparison`.
- Click `/bench` to see ops/sec.
- Read `/docs/comparison` for the per-competitor narrative.
- Check the npm version and last-publish date (currently `0.2.3` — pre-1.0, which is a signal worth handling honestly; see [Vision](vision.md) §Versioning note).

The honest framing in `/docs/comparison` already serves this persona well. The homepage hero does not — see [site/known-issues](../site/known-issues.md) item #5.

## See Also

- [Vision](vision.md) — what zod4-mock is.
- [Differentiators](differentiators.md) — the wedge they're paying for.
- [site/vision](../site/vision.md) — how the site is organized to serve this audience.
