# B110: JsonTree renders a Date as a readable ISO string, not empty `{ }`

## Context

The B101 per-page designer pass (`wiki/backlog/done/B101-docs-rebuild-getting-started-concepts.md`)
spotted two data-quality quirks in the `<RelatedShowcase entity="user">` JsonTree slice on
`/docs/getting-started` (it also reproduces on `/showcase`, since both render the same
`site/src/lib/runners/ecommerce.ts` world):

1. A `z.date()` field (`userSchema.createdAt`) generates a JavaScript `Date`, but the
   `JsonTree` widget renders it as `▼ { }` — an empty object.
2. A field named `zip` (`userSchema.address.zip`, a bare `z.string()`) generates a
   multi-word word-salad value (e.g. `"tango layer charlie delta module oscar h"`) instead
   of a postal code.

This item card is `wiki/backlog/doing/B110-jsontree-date-and-zip-data-quality.md`. Type is
`bug` (real user-visible wrong output on shipped docs/showcase pages) → full track,
regression test required (`wiki/architecture.md` Rules → D6). Related pages:
`wiki/architecture.md` (Rules; site lives under `site/`, pnpm, vitest/Playwright test
commands), `wiki/specs/README.md` (spec format).

**Ground-truth (root cause, defect 1).** In
`site/src/lib/widgets/JsonTree.svelte` the value is classified as an object by
`const isObj = $derived(value !== null && typeof value === 'object' && !Array.isArray(value))`.
Because `typeof aDate === 'object'` and a `Date` is not an array, a `Date` enters the object
branch, where `Object.entries(date)` is `[]` (a `Date` has no enumerable own keys) — so it
renders as `▼ { }`. The component already has a `formatPrimitive` that special-cases
`v instanceof Date` → `"…ISO…"` (line 27), but the object branch shadows it so that code path
is never reached for a `Date`. The value reaching `JsonTree` is the **raw `Date` object** (the
registry stores the generated `Date`; nothing serializes it before render), and it reaches
the widget identically on SSR and client (the widget is pure render — no `window`/`document`
or `onMount` branch), so the defect is identical on both. **Fix scope:** treat a `Date` value
as a leaf in `JsonTree` (route it to `formatPrimitive`, not the object branch), so it renders
as its ISO string. The fix must stay behaviour-neutral for all non-`Date` values (D1).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Scope decision — the `zip` defect is split out

This spec covers **defect 1 only** (the `JsonTree` Date-render fix). **Defect 2 (`zip`
word-salad) is recommended for its own backlog item.** Rationale:

- Defect 1 is a **site widget render bug** — one Svelte file (`JsonTree.svelte`), no library
  API change, no changeset to the published package, verified by a site component/e2e test.
- Defect 2 is a **library public-behaviour change**. Ground-truth: `DEFAULT_KEY_MAP.string`
  in `src/generators/data/key-map.ts` already maps `zipcode` / `postalcode` / `postal_code` /
  `postcode` to `data.location.zipCode`, but **bare `zip` is absent**, so a `zip` field falls
  through to the generic string fallback. The fix (add a `zip` alias — and likely `postal` —
  to `DEFAULT_KEY_MAP.string`) changes generation output for **every consumer** of the
  library, so it needs: a library coverage test, a `.changeset/` entry (patch — new
  heuristic), and a `docs/key-heuristics.md` regenerate via the docs flow. Mixing that
  library-API-behaviour change with a site-widget bug in one card couples two different tracks
  and two changesets into one commit.

Keeping them separate keeps each commit, changeset, and test surface clean. **Recommendation
to the manager:** file a new `type: bug` (library) item — e.g. "`zip`/`postal` field
generates word-salad; add `zip` alias to `DEFAULT_KEY_MAP.string` (→ `location.zipCode`)" —
on the full track with a library coverage test + changeset. It is low-risk and self-contained.
That item is **not** filed by this spec-writer; the manager owns intake.

## Requirements

### B110-R1: A Date value renders as an ISO date string, not an empty object

`JsonTree` **MUST** render a JavaScript `Date` value as its ISO-8601 string (the output of
`Date.prototype.toISOString()`, quoted as a JSON string), not as an object node and never as
an empty `{ }`.

- Scenario (UI): Date leaf shows an ISO string
  GIVEN a `JsonTree` rendered with `value = { createdAt: new Date('2024-01-15T00:00:00.000Z') }`
  WHEN the tree renders (the `createdAt` field is shown)
  THEN the rendered output contains the text `"2024-01-15T00:00:00.000Z"`
  AND it does NOT render a collapse toggle (`▶`/`▼`) or a `{ }` / "0 keys" node for the
  `createdAt` value.

- Scenario (UI): top-level Date value is a leaf, not `{ }`
  GIVEN a `JsonTree` rendered with `value = new Date('2024-01-15T00:00:00.000Z')` directly
  WHEN the tree renders
  THEN the rendered output is the single leaf string `"2024-01-15T00:00:00.000Z"`
  AND the output contains no `{ }` and no `… 0 keys` ellipsis.

### B110-R2: Regression — the showcase `user` slice no longer shows `createdAt` as `{ }`

The `<RelatedShowcase entity="user">` / `/showcase` `user` slice **MUST NOT** render its
`createdAt` (`z.date()`) field as an empty object; it **MUST** render an ISO-8601 date string.
(This is the reported failure; D6 requires a regression test pinned to it.)

- Scenario (UI): showcase user createdAt is a date string
  GIVEN the rendered `user` entity from `site/src/lib/runners/ecommerce.ts` (`generateWorld(42).users[0]`),
  whose `createdAt` is a `Date`
  WHEN it is rendered through `JsonTree` (as `<RelatedShowcase entity="user">` does, or on `/showcase`)
  THEN the `createdAt` value renders as a quoted ISO-8601 date string matching
  `/^"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"$/`
  AND the `createdAt` value is NOT rendered as a `{ }` / "0 keys" object node.

### B110-R3: Non-Date values render exactly as before

The Date-handling change **MUST** be behaviour-neutral for every non-`Date` value: plain
objects, arrays, strings, numbers, booleans, `null`, and `undefined` render identically to the
pre-fix widget (D1 — no incidental behaviour change).

- Scenario (UI): plain object still expands with keys
  GIVEN a `JsonTree` rendered with `value = { id: 'a', qty: 2, items: [{ id: 'b' }] }`
  WHEN the tree renders
  THEN it shows an expandable object node with the keys `"id"`, `"qty"`, `"items"`
  AND `items` renders as an array node (its `[` / `]` brackets and one child object) — i.e.
  objects and arrays are unchanged.

- Scenario (UI): string-valued ISO-looking field unchanged
  GIVEN a `JsonTree` rendered with `value = { createdAt: '2024-01-15' }` (a plain string, not a `Date`)
  WHEN the tree renders
  THEN the `createdAt` value renders as the leaf string `"2024-01-15"` exactly as before (no
  ISO normalization, no quoting change beyond the existing string formatting).

## Out of scope

- **The `zip` word-salad defect (defect 2).** Recommended split into its own library item
  (see Scope decision). This spec does not change `src/generators/data/key-map.ts` and adds no
  library coverage test, no changeset to the published package, and no `docs/` regenerate.
- **Other non-plain-object value types** (`Map`, `Set`, `RegExp`, class instances, `BigInt`,
  `Symbol`). The reported defect and the showcase data only involve `Date`. Generalizing the
  leaf-detection beyond `Date` is not required here; if the implementer chooses a general
  "non-plain-object → leaf" guard, it MUST still satisfy R1–R3 and remain behaviour-neutral
  for plain objects/arrays. No requirement asserts behaviour for those other types.
- **Date formatting style.** The contract is the ISO-8601 string (`toISOString()`); a
  localized/"pretty" date format is not required and not specified here.
- **Any change to the generated `Date` value itself**, to `RelatedShowcase` data selection, or
  to the ecommerce schemas/runner.

## Open questions

- **(non-blocking)** Should the implementer ship a narrow `value instanceof Date` leaf check
  or a broader "non-plain-object → leaf" guard? Either satisfies R1–R3; the narrow check is the
  minimal fix and matches the reported defect. Recorded as an implementation choice, not a
  blocker — the spec is testable under either. Default recommendation: narrow `instanceof Date`
  check, since the broader guard's behaviour for other exotic types is explicitly out of scope.
- **(non-blocking)** Regression-test surface for R2: a Storybook/component test on
  `JsonTree.svelte` rendering a `Date` (mirrors `JsonTree.stories.svelte`) is the closest,
  fastest anchor and is sufficient for D6; a `/showcase` Playwright assertion (`site/e2e/`) is
  optional reinforcement. test-writer's choice; recorded, not blocking.

No blocking questions. The spec may advance to `test-writer`.
