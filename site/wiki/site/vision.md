# Site Vision: gen-bench = the zod4-mock homepage

> Sources: gen-bench design.md, 2026-05-13; user direction, 2026-05-13; code review 2026-05-13
> Raw: [Design Doc](../../raw/product/2026-05-13-design-doc.md); [Review Findings](../../raw/site/2026-05-13-review-findings.md)

## Overview

`gen-bench` was scoped as a benchmark/showcase application. The strategic decision (2026-05-13) is to **promote it to the project homepage of `zod4-mock`**. The same routes mostly survive, but their relative priority shifts: relational proof becomes the lead exhibit, speed becomes supporting evidence, and onboarding (`/docs/getting-started`) sits one click from the hero. This article documents that positioning so future implementation decisions stay coherent.

## The shift in framing

Before (today): "A SvelteKit app that benchmarks three mock libraries and showcases zod4-mock features."

After (target): "The project landing page for zod4-mock — what it is, why it's the right choice for relational schema-driven mocks, how to use it, and how fast it is."

Two consequences:

1. **The visitor isn't a benchmark spectator.** They're an evaluator. They want answers, not a sport. The site should answer their questions in order ([product/audience](../product/audience.md) §funnel).
2. **The bench page is no longer the centerpiece.** It supports the speed claim, but the speed claim itself is the third point on the page, not the first.

## Route role assignments (target)

| Route                   | Today's role                                | Target role                                                                                 |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/`                     | Hero + feature matrix + summary cards       | **Hero with relational proof above the fold**; install CTA; matrix below                    |
| `/showcase`             | Relational demo (separate page)             | The proof exhibit; some of it pulled forward into `/`                                       |
| `/docs/getting-started` | Onboarding doc with live playground         | The "install + try" landing target — one click from hero                                    |
| `/bench`                | Live in-browser benchmark, the main exhibit | "View the numbers" — supporting evidence, not the lead                                      |
| `/table`                | DOM stress test                             | Either reframe as honest generation-cost reporting, or de-emphasize                         |
| `/docs/*`               | Reference docs                              | Unchanged — used by comparison-shopper persona ([product/audience](../product/audience.md)) |

The implementation plan that gets us there lives in [roadmap](roadmap.md) P1.

## What the site must _not_ do

- **Overclaim.** The homepage hero must not say "faster than the alternatives" — that's contradicted by the project's own benchmark data. The honest pitch from [product/differentiators](../product/differentiators.md) is "faster than schema-driven alternatives; competitive with hand-coded faker, with zero shape maintenance." _(Fixed in P0 pass, 2026-05-16.)_
- **Foreground the bench.** It's load-bearing for credibility but it's not the hook. The hook is relational + type-safe + zero shape maintenance.
- **Hide the relational story behind navigation.** `/showcase` must not be the only entry point to the relational proof. _(Addressed in P1 pass — inline relational exhibit added to `/`, 2026-05-16.)_

## What stays

- The token-driven CSS system (dark base, library identity colors, 8px spacing) — already aligned with the zod4-mock playground for future merge.
- The mdsvex + Shiki + interactive `playground` code-fence pipeline — this is genuinely good and unique.
- The Storybook + Vitest discipline — keeps components documented and tested.
- The CLI benchmark (`bench/perf.test.ts`) — runs in CI / locally and is statistically solid (1k warmup, 5k runs).

## The merge horizon

`design.md` already states: _"This project is designed to eventually merge with the zod4-mock playground."_ When that happens, `gen-bench` becomes the playground/site directory inside the `zod4-mock` repo. This wiki's `product/` topic should travel with it (it's about the library, not the site); `site/` may either follow or be archived depending on how the merged repo is organized. See [roadmap](roadmap.md) P3.

## See Also

- [product/vision](../product/vision.md) — what zod4-mock is (the product the site sells).
- [product/differentiators](../product/differentiators.md) — the wedge that should lead the hero.
- [current-state](current-state.md) — what's built today.
- [roadmap](roadmap.md) — the path from current state to this vision.
- [known-issues](known-issues.md) — issues that block the shift.
