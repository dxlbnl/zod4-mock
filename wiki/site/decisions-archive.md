# gen-bench decisions archive (dropped on merge)

When gen-bench was folded into zod4-mock as `site/` (2026-06-03), six of its
eleven D-entries were dropped rather than promoted to zod4-mock D-numbers. Each
was redundant or moot post-merge. The remaining five (D-04, D-07, D-09, D-10,
D-11) were promoted to zod4-mock D16–D20 with their original IDs preserved as
`historical-id:` lines in `wiki/decisions.md`. See that file for the live ADRs.

This page exists so a future contributor can trace why an entry that appears in
gen-bench's git history doesn't show up as a current zod4-mock decision.

## Dropped entries

| gen-bench D | Original title                                       | Reason dropped                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-01        | Runes-only mode, project-wide                        | Site-local Svelte convention; lives in `wiki/site/architecture.md` if at all. Not a library-wide standing constraint.                                                                                                    |
| D-02        | TypeScript strict mode, no escape hatches            | Redundant with zod4-mock D1 (already binding repo-wide).                                                                                                                                                                 |
| D-03        | oxlint + oxfmt instead of ESLint + Prettier          | Already implicit in zod4-mock's root devDependencies before the merge. No conflict, no new rule needed.                                                                                                                  |
| D-05        | Storybook mock pattern: hoist `fn()` to module scope | Site-local code convention, not a binding rule. Lives in `wiki/site/architecture.md` if needed.                                                                                                                          |
| D-06        | `mulberry32` PRNG inlined in `ecommerce.ts`          | Already obsolete in code: `site/src/lib/runners/ecommerce.ts` uses `ctx.prng.{int,pick}` from zod4-mock. gen-bench's own P0-4 completed item performed the rewrite before merge.                                         |
| D-08        | `zod4-mock` pinned to exact version                  | Moot post-merge — `workspace:*` makes the pin a tautology. The intent (bench results attributable to a known version) is preserved by the `bench/results/latest.json` header capturing the resolved version at run time. |

## Promoted entries (live in `wiki/decisions.md`)

| gen-bench D | zod4-mock D | Title                                                 |
| ----------- | ----------- | ----------------------------------------------------- |
| D-04        | D16         | zod3 alias for benchmark parity within `site/`        |
| D-07        | D17         | Two-tier benchmark — CLI citable, browser qualitative |
| D-09        | D18         | mdsvex `playground` code-fence hydration pattern      |
| D-10        | D19         | The site is the project homepage                      |
| D-11        | D20         | Honest framing for speed claims                       |
