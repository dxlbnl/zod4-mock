# Docs system design — research report

> Backlog item: [B94](../../backlog/doing/B94-docs-system-design.md). Replaces
> [B84](../../backlog/doing/B84-site-architecture-rebuild.md) §5 and resets B84
> Phase 2.
> Status: research, review-flagged. Maintainer picks the authoring path before
> implementation cards are filed.
> Date: 2026-06-04.

## TL;DR

Build the docs site as a **bespoke SvelteKit `/docs/*` route tree authored from
typed page modules (`+page.svelte` / `+page.ts`) under `site/src/routes/docs/`**,
backed by a small set of **first-class doc primitives** (`<DocPage>`,
`<SignatureBlock>`, `<Playground>`, `<SpeedClaim>`, `<InstallBlock>`,
`<RelatedShowcase>`) layered on `@dxlbnl/ui`. Keep the published `docs/*.md`
canonical for D5; add a **D5 surface broadening**: an API change MAY satisfy
D5 by updating the site's API-reference page _instead of_ `docs/api-reference.md`,
provided a build-time parity guard regenerates / verifies the published `docs/`
artifact from the same source. Search ships via **Pagefind** over the
prerendered routes. Astro Starlight is rejected (theme break, SvelteKit
disowned), and a flat mdsvex render of `docs/*.md` is rejected (already nixed).
Phase 2 ships in three cards: (1) chrome + nav + landing, (2) Getting Started
and Concepts pages rebuilt on the new primitives, (3) API reference structured
view with parity guard + Pagefind search.

---

## 1. Reference benchmarks

Ten docs sites worth stealing from. For each, I note the **concrete primitive**
that a flat mdsvex render of `docs/*.md` lacks today.

1. **Stripe API reference** — the canonical split-pane: prose-on-left, executable
   request/response-on-right per endpoint, with a **persistent language switcher**
   (`curl` / Node / Python / Ruby / Go / Java / PHP / .NET) that swaps every
   right-pane snippet on the page in lockstep. For us, the analogue is a
   per-page **`<SignatureBlock>`** that pairs a TS signature with a live
   `<Playground>` of the same call — and a **package-manager switcher**
   (`pnpm` / `npm` / `yarn` / `bun`) that swaps every install snippet on the
   page coherently. A flat md render gives you neither.

2. **Astro Starlight** — out-of-the-box **autogen sidebar with manual override**,
   versioning hooks, **Pagefind** integration (built in), and an MDX-flavoured
   authoring model with components import-able from inside the page. The
   relevant gap a flat mdsvex render has: no sidebar IA, no manual ordering
   knob, no built-in prose-aware search. (Starlight itself is rejected as the
   _runner_ — see §2 — but the IA primitives it codifies are the target.)

3. **Effect docs** — interactive **TS-aware code blocks** with hover types and
   in-page diagnostics rendered alongside narrative; "Try It" buttons drop a
   block into a remote playground (Effect playground / StackBlitz). For us:
   `<Playground>` + a future "open in Explorer" deep link to `/explorer`.

4. **Svelte docs** — **inline runnable REPL embeds** per concept (the REPL
   widget renders the result panel right under the code block) and **kit-aware
   navigation** that adjusts depth based on the section ("Tutorial" vs
   "Reference"). Our analogue is the existing base64-hydrated playground
   pattern (D18) but used systematically per concept rather than as a one-off
   per page.

5. **Linear docs** — the **command palette** ("⌘K → jump to any heading, any
   API symbol, any guide") binds search and navigation into one keyboard
   surface. Worth stealing because the docs site's heaviest user (the
   returning developer) lives in the palette. Achievable as a thin wrapper on
   the Pagefind index plus a list of API-symbol entries pulled from the
   reference page's frontmatter.

6. **Cloudflare Workers / Pages** — **per-page "Edit this page on GitHub"**
   link, **version badge** (live / beta / deprecated) per heading, and an
   end-of-page **"Was this helpful?"** widget. Cheap to add; honest framing
   primitive (the D17/D20-aligned "this number was measured at" badge) is the
   same shape.

7. **Tailwind CSS docs** — **install snippet with PM switcher** (`pnpm` /
   `npm` / `yarn` / `bun` / `astro add`) bound to a top-level preference that
   persists across the whole site. Trivial to imitate, hugely better than
   "here's an npm command, figure out the pnpm one yourself."

8. **MDN web docs / Mozilla** — **glossary tooltips** and **prose-anchored
   permalinks** (every paragraph and term has its own anchor + share link).
   The "what is determinism here?" mid-paragraph tooltip is exactly the kind
   of concept-anchor that's invisible to a flat md render but trivial to add
   with a `<DefRef term="…">` primitive that opens an in-page tooltip _and_
   adds the term to the Pagefind index as a concept.

9. **Prisma docs** — **"prerequisites" callouts at the top of each page**
   (what you need to have read first) and a sidebar that visibly groups
   "Concepts" / "Reference" / "Guides" / "How to" rather than slug-alphabet
   order. Our docs already imply this taxonomy in `docs/index.md`; the site
   should make it visible.

10. **VitePress (vuejs.org)** — clean **table of contents on the right rail**
    that auto-tracks scroll position, plus **"On this page"** anchors with
    smooth-scroll. The right rail is where the dense API-reference page
    becomes navigable rather than a 58 kB scroll.

What the patterns above share: every one of them is a **named primitive
the author calls from inside the page** — not a markdown convention. A flat
md render that happens to be styled has no such vocabulary. The docs system
we want is a **vocabulary of doc primitives**, expressed in code, that pages
import — which is much closer to MDX than to "render md as HTML."

---

## 2. Authoring path options

I assess four (your three plus an obvious fourth).

### (a) mdsvex + custom Svelte components, authoring under `site/content/docs/`

The current `gen-bench` shape, but with a real component library hanging off
the page.

- **Cost**: lowest. mdsvex is already configured (`site/svelte.config.js`),
  D18 is honoured, the playground fence pattern works. Marginal cost = build
  the component library and document the authoring API.
- **Theme integration with `@dxlbnl/ui`**: native. Components live in
  `site/src/lib/docs/widgets/`, consume tokens from the `dxlbnl` layer, and
  follow D21 by sitting in the `site` layer.
- **Search**: Pagefind over the prerendered routes. Mdsvex output is HTML by
  the time Pagefind sees it; no special integration.
- **Build**: zero new build pipeline; SvelteKit + mdsvex already work.
- **D5/D17/D18/D19/D20**: D18 native (mdsvex is the renderer). D17/D20 native
  via a `<SpeedClaim>` primitive (see §4). D5: the canonical `docs/*.md` files
  stay separate from `site/content/docs/*.md`, so this option **does not solve
  the dual-source-of-truth problem on its own** — pair with the `docs/` sync
  story in §6. D19: SvelteKit handles deep-link landing.
- **Forfeits**: per-page Svelte/runes ergonomics are slightly awkward inside
  `.md` (mdsvex `<script>` blocks work, but type-checking inside an `.md`
  file is weaker than in a `.svelte` file; runes inside mdsvex are
  documented-but-bumpy). Authors writing a complex API-reference page will
  hit the limit before they hit the limit on (c).

### (b) Astro Starlight (or VitePress) as a sub-app under `site/docs-app/`

A second app at `/docs/*`, themed against `@dxlbnl/ui` tokens.

- **Cost**: high. Two SvelteKit-vs-Astro toolchains in one repo (Starlight is
  Astro-native; VitePress is Vue/Vite). Two Vite configs, two build outputs,
  reverse-proxied or path-mounted under Vercel. The "I want to use the same
  `<Playground>` component on `/docs/getting-started` that I use on `/`"
  problem becomes "build a Svelte component once, then port it to a `.astro`
  file (or React for VitePress)" — a permanent forking cost.
- **Theme integration with `@dxlbnl/ui`**: surface-only. Tokens (`tokens.css`)
  port fine — they're plain CSS custom properties — but actual `@dxlbnl/ui`
  components do not run in Astro (SvelteKit-2-peered) or in VitePress (Vue).
  The site's identity (`@layer dxlbnl, site`, D21) collapses to "two sites
  that happen to share a colour palette."
- **Search**: Starlight ships Pagefind built-in. VitePress has a built-in
  client-side index. Both are fine.
- **Build**: two builds, two deploy targets (or one Vercel monorepo with
  rewrites). Doable, but every change to nav, footer, or chrome touches two
  apps.
- **D5/D17/D18/D19/D20**: D18 needs a successor rule (no mdsvex). D17/D20 need
  a re-implementation of the speed-claim primitive in the docs-app stack.
  D19 is OK (Starlight handles deep-link routing well). D5 is the same
  drift problem as (a).
- **Forfeits**: design-system coherence (the central reason `@dxlbnl/ui`
  exists); ability to embed `/explorer` or `/showcase` slices inline in a
  doc page; ability to share `<Playground>` between the homepage and the
  docs page. **Rejected.**

### (c) Bespoke — typed page modules under `site/src/routes/docs/`

Each doc page is a `+page.svelte` (with optional `+page.ts` for metadata),
importing doc primitives directly. Authors write _both_ prose and structured
content inside a single file with full Svelte 5 + TypeScript + runes support.

```svelte
<!-- site/src/routes/docs/getting-started/+page.svelte -->
<script lang="ts">
  import DocPage from "$lib/docs/widgets/DocPage.svelte";
  import InstallBlock from "$lib/docs/widgets/InstallBlock.svelte";
  import Playground from "$lib/docs/widgets/Playground.svelte";
  import SignatureBlock from "$lib/docs/widgets/SignatureBlock.svelte";
</script>

<DocPage
  title="Getting Started"
  sidebarGroup="concepts"
  order={1}
  prerequisites={[]}
  related={["/docs/concepts", "/docs/api"]}
>
  <p>zod4-mock generates realistic, deterministic mock data...</p>

  <InstallBlock pkg="zod4-mock zod" />

  <h2>Generate without setup</h2>
  <p>Pass a schema, get data back.</p>

  <Playground initialCode={`...`} />
</DocPage>
```

- **Cost**: medium. We build the primitives once; pages reuse them. Authoring
  feels like writing a small Svelte component — already a project-native
  skill — instead of learning mdsvex's escape hatches.
- **Theme integration with `@dxlbnl/ui`**: native — primitives compose
  `@dxlbnl/ui` `Container` / `Stack` / `Heading` / `Card` underneath.
- **Search**: Pagefind over prerendered routes. Because content is in Svelte
  templates rather than `.md`, Pagefind needs an HTML data-attribute hint to
  exclude widget chrome (`data-pagefind-ignore` / `data-pagefind-body`); this
  is documented and standard.
- **Build**: zero new build infra; SvelteKit handles prerender, asset
  pipeline, routing.
- **D5/D17/D18/D19/D20**: D18 changes from "mdsvex playground fences" to
  "any client-side editor primitive imported as a Svelte component" — a
  successor rule (see §3 below). D17/D20 enforced via a typed `<SpeedClaim>`
  primitive that requires a `source` prop. D19 native. D5 needs the sync
  story (§6).
- **Forfeits**: pure-md authoring ease (some contributors prefer typing
  `## Heading` over `<h2>Heading</h2>`). Mitigated by keeping the primitive
  surface minimal (`<DocPage>` wraps a `<Prose>` from `@dxlbnl/ui`, which
  accepts raw markup) and by allowing **`.md.svelte` files** through a
  scoped mdsvex configuration if the trade-off bites later.

### (d) Hybrid: bespoke for structured pages, mdsvex for prose-heavy pages

The honest version: API reference is structured (split-pane signature +
example + parameters table), so it _wants_ to be a Svelte page; Getting
Started is mostly prose with a few playgrounds, so it _can_ be mdsvex. SvelteKit
routes don't care — `/docs/getting-started/+page.svelte` and
`/docs/api/+page.svelte` coexist; mdsvex pages can live as
`/docs/concepts/+page.md` thanks to mdsvex's SvelteKit integration.

- **Cost**: medium-low. Single primitive library, two authoring entry points
  (`.svelte` or `.md`). Authors pick the one that fits the page.
- **Theme + search + build**: same as (c).
- **D18 successor**: same as (c).
- **Forfeits**: a small consistency cost — two authoring shapes — paid back
  by letting the dense pages be code and the prose pages stay prose.

### Recommendation

**Adopt (c) as the baseline, with (d)'s opt-in escape hatch.** Every doc page
is a `+page.svelte` by default, importing doc primitives. mdsvex remains
enabled for the routes that want it (the existing config already supports
both extensions). The primitive library is the differentiator — it's what
turns "a styled markdown render" into "a docs site that does justice to the
library."

**Astro Starlight (b) is rejected** for the design-system fork, the
SvelteKit-disown, and the `<Playground>` / `/explorer` embedding problem.
The flat `import.meta.glob('/docs/*.md')` redux is rejected per the
maintainer's prior call.

---

## 3. Content model

### Where canonical `docs/api-reference.md` lives

**Keep `docs/` as the canonical filesystem location for D5 purposes**, but
redefine D5 from "edit this specific `.md` file" to **"update a documented
API-reference surface in the same step"**. The two acceptable D5 surfaces:

1. **The site's API-reference page** (`site/src/routes/docs/api/`) — preferred
   for any change that benefits from the structured primitives
   (`<SignatureBlock>`, `<ParameterTable>`, `<Playground>`).
2. **`docs/api-reference.md`** — preferred for any change a downstream
   consumer reading the npm tarball (or the GitHub repo) needs to see.

Either surface satisfies D5 **on the condition that a build-time parity
guard** (see §6) keeps `docs/api-reference.md` regenerated from the site
source (or vice-versa) before publish. The reviewer's standing check on D5
moves from "did `docs/api-reference.md` change?" to "did either D5 surface
change, and does `pnpm docs:check` pass?" (see §6 for the script).

### How interactive content authors into a page

In option (c), interactivity is a Svelte component import. The author writes:

```svelte
<Playground initialCode={`import { generate } from "zod4-mock";\n…`} />
```

— and the primitive handles SSR safety (the `mount`/`unmount` pattern the
current `+page.svelte` already uses), the editor chrome, the live preview
panel. No markdown bias is broken because there is no markdown — the page is
a Svelte file. mdsvex pages retain the base64-fence approach (D18 in its
current form), which means we can mix-and-match.

### Versioning

**Punt for now.** Pre-1.0, ship the current major's docs; no version selector.
Add a one-line "this doc reflects `zod4-mock@<version>`" badge in the
`<DocPage>` chrome (the version is read at build time from the workspace
root `package.json`). When `zod4-mock` hits 1.x, file a follow-up for a
version selector — SvelteKit supports a `/v0/docs/*` and `/v1/docs/*` route
shape with shared chrome, but designing that now is premature.

---

## 4. Interactive content surfaces

The primitives the docs need, prioritised.

### Ship in v1 (Phase 2)

| Primitive | Purpose | Notes |
| --- | --- | --- |
| **`<DocPage>`** | Page shell. Title, sidebar group, order, prerequisites, related links, edit-on-GitHub, "On this page" right rail (auto-generated from headings). | Wraps `@dxlbnl/ui` `Container` + `Stack` + `Prose`. Frontmatter-equivalent passed as props. |
| **`<Playground>`** | The existing `SchemaPlayground` (CodeMirror + `new Function` eval + live JSON output), now a first-class import. | Reuses the existing widget. D18 succession: see "D18 successor" below. |
| **`<SignatureBlock>`** | TS signature display + 1–2-line description + an optional inline `<Playground>`. Renders as a `@dxlbnl/ui` `Card`. | The structured replacement for the giant "method block" in `docs/api-reference.md`. |
| **`<ParameterTable>`** | Typed parameter rows. Each row: name, type (rendered with Shiki highlight), default, description. | Generates from a TS-shaped data prop, not from markdown table syntax — type-safety inside the doc. |
| **`<InstallBlock>`** | Install command with `pnpm` / `npm` / `yarn` / `bun` switcher. PM preference stored in `localStorage`, applied across the site. | Closes B77 (install copy button) at primitive level: a click on any block copies + toasts. |
| **`<SpeedClaim>`** | The honest framing primitive. Required props: `tier`, `value` (e.g. `"2.7×"`), `vs` (e.g. `"@anatine/zod-mock"`), and `source` (string path to `site/bench/results/latest.json`, OR a snapshot date + version triple). Renders as a `StatCard` with the citation line below it. **No `<SpeedClaim>` may be used without a `source` prop — TypeScript enforces this.** | The D17/D20 primitive. Reviewer no longer reads prose for "fastest" — the type system rejects an undecorated speed claim. |
| **`<DefRef term=… />`** | Concept tooltip (MDN-style). Adds the term to the Pagefind concept index. | Cheap and high-leverage — every "world" / "registry" / "matcher" mention links to its concept page. |
| **`<RelatedShowcase entity=…>`** | Embeds a `/showcase` entity slice inline (just the `JsonTree` + `RelationCallout` for one entity), with a "see the full demo →" link to `/showcase`. | Reuses the existing showcase widgets. |
| **`<Prerequisites pages={["/docs/concepts"]}>`** | The Prisma "what you need to have read" callout. Renders as a `@dxlbnl/ui` `Alert` (info variant). | Trivial; high signal for newcomers. |

### Defer to v2 (a follow-up card)

| Primitive | Reason to defer |
| --- | --- |
| **Type-aware code blocks** (paste TS, get hover-tooltips for `z.string()` etc.) | Big build — needs a TS-in-the-browser language server (Monaco / Volar). Defer until at least three doc pages would benefit. |
| **Inline benchmark bars** (one chart inside a doc page) | The `/bench` page exists; from a doc page, a `<RelatedShowcase entity="bench">` link is enough at v1. |
| **Inline `/explorer` slice** (mount Constellation in a doc) | Blocks on Phase 4a (`world.trace()` API) shipping. Filed under the Explorer card stack. |
| **Command palette** (Linear-style ⌘K) | Land Pagefind first; the palette is a thin shell over the Pagefind index + API-symbol manifest. Defer until search is in. |

### D18 successor rule

If we keep mdsvex as an authoring option (recommendation (d)), D18 survives
unchanged for mdsvex pages. For `+page.svelte` pages, the D18-equivalent is:

> Any docs primitive that mounts an editor or other `window`-touching
> widget MUST defer construction to `onMount` (or behind an `if (browser)`
> guard) and MUST NOT touch `window`/`document` at module load. The
> `<Playground>` primitive is the reference implementation.

This generalises D18 from "mdsvex playground fences" to "any client-side
editor primitive." Logged as a one-line architecture Rule when this report's
implementation lands.

---

## 5. Search

### Recommendation: Pagefind

**Pagefind** — fully static, ~50 kB runtime, indexes prerendered HTML, no
external service, no API key. It works against any prerendered SvelteKit
output and Starlight ships with it built-in (a sign of trust). Pagefind has
first-class support for marking concept terms via `data-pagefind-meta` and
for excluding chrome via `data-pagefind-ignore` — which lets the `<DefRef>`
primitive and the `<DocPage>` sidebar emit the right hints automatically.

### How the index reaches prose concepts, not just headings

Pagefind's defaults already index every word in prose; it ranks headings
higher. The "concepts in prose" question is really about **synonyms and
cross-references**. Two techniques:

1. **`<DefRef term="determinism">…</DefRef>`** primitives emit a
   `data-pagefind-meta="concept:determinism"` attribute. Pagefind surfaces
   concept hits as a separate filter ("Concepts: determinism (3 pages)").
   Authors don't think about the search index — they tag the term, the
   index gets it for free.

2. **A typed `concepts.ts` manifest** (`site/src/lib/docs/concepts.ts`)
   declares the canonical concept → page mapping; the Pagefind build step
   reads it and emits a synonym table. This makes "matcher" / "ctx" / "field
   resolver" route to the same concept page from search.

### Why not Algolia DocSearch / flexsearch / something else

- **Algolia DocSearch** is free for open source but requires application
  approval, an external service, and an API key in the build. Out of scope
  pre-1.0; Pagefind covers the use case.
- **flexsearch** is fine but requires hand-building the index from page
  metadata, plus a custom search UI. Pagefind gives both for free.
- **Lunr.js** is dated; the maintained successors (Minisearch, Orama) are
  fine but offer no advantage over Pagefind.

---

## 6. Sync with `docs/`

This is the load-bearing question. The maintainer rejected "site renders
`docs/*.md`" already; the maintainer also values `docs/api-reference.md`
because it's what the npm consumer reads in the tarball. We need both
surfaces to exist and stay in sync.

### Four options re-stated, honestly

| Option | What it does | Trade-off |
| --- | --- | --- |
| **(α) Author canonical in `docs/`, site reads** | The rejected hybrid. | Maintainer rejected because flat md is too thin for a docs site. |
| **(β) Author canonical in site source, generate `docs/` at build time** | Site is the source of truth; `docs/` is a derived artefact emitted by a `pnpm docs:generate` script that walks the site's API page modules and writes `docs/api-reference.md`. | Loses easy-to-edit md for downstream contributors. Generator must produce md that's good to read (renderable on GitHub / npm). |
| **(γ) Author both, parity script + reviewer check** | Author writes both; `pnpm docs:check` runs in CI and asserts surface parity (per-symbol coverage, signature equality). Reviewer rejects PRs that change one side without the other. | Two writes per change. Mitigated if the parity script gives a concrete diff and a `--fix` mode that regenerates one side. |
| **(δ) Move D5 to `docs/api.json`** | Generate a structured `docs/api.json` from TypeScript source (typedoc-style); both the site's API page and `docs/api-reference.md` read from it. | Biggest infra build; tightest correctness; biggest change to the rule set. |

### Recommendation: **(β) — site is the source of truth, `docs/` is regenerated**

This is the option that does justice to the docs site without breaking the
npm-tarball reader. The mechanics:

1. The structured API page lives at
   `site/src/routes/docs/api/+page.svelte`, importing typed signature data
   from `site/src/lib/docs/api/manifest.ts`. The manifest is a single
   exported `ApiManifest` constant — a `ReadonlyArray<ApiSymbol>` where each
   `ApiSymbol` has `name`, `kind`, `signature`, `description`, `examples`,
   `since`, `seeAlso`. **TypeScript checks the manifest** against the actual
   library types via a thin assertion at the bottom of the file — if
   `generate` changes signature in `src/index.ts`, the manifest stops type
   checking until the author updates it.

2. **`pnpm docs:generate`** walks the manifest and emits
   `docs/api-reference.md` from a template — same per-symbol shape the
   current 1237-line file has. The script is a simple TS file under
   `scripts/` (run via `tsx` or compiled), takes no flags, idempotent.

3. **`pnpm docs:check`** runs `pnpm docs:generate --check` (no-write mode)
   in CI; fails if the on-disk `docs/api-reference.md` doesn't match what the
   manifest would produce. Local fix: `pnpm docs:generate` and commit.

4. **D5 rewrites**: "When a public API changes,
   `site/src/lib/docs/api/manifest.ts` MUST be updated in the same step;
   `docs/api-reference.md` is regenerated and committed." Plain-English
   the rule still says "docs update with code"; mechanically the entry
   point is the manifest.

5. **The other shipped `docs/*.md` files** (`concepts.md`,
   `getting-started.md`, `key-heuristics.md`, `recipes.md`,
   `zod4-schema-coverage.md`, `bugs.md`, `index.md`) **stay hand-edited
   in `docs/`** as the canonical prose. The corresponding site pages
   (`site/src/routes/docs/concepts/+page.svelte` etc.) are
   hand-authored and may reuse prose from `docs/` directly — they're
   shorter, prose-heavy, and the dual-author cost is small relative to
   the gain (structured site rendering with interactive primitives).
   Parity here is human-policed, not script-enforced; this is acceptable
   because these files don't change with every API change — only the
   reference does.

This narrows D5's automated parity to **one file pair** (manifest ↔
`docs/api-reference.md`), which is tractable; the broader docs/ ↔ site/
correspondence is wider but doesn't carry a hard rule.

### Why not (γ)

Considered seriously. The dealbreaker: every API change costs two coherent
edits across two file shapes (md and TS data) with no automated forcing
function until the reviewer runs the parity script — which is the same
shape as the drift that landed `gen-bench` with two divergent doc trees in
the first place. (β)'s generator turns one of those edits into a script
invocation. Worth the script's complexity.

### Why not (δ)

Biggest infra build for a project that doesn't yet have any code that
emits structured docs. typedoc-style extraction is overengineered when the
maintainer hand-curates per-symbol prose (which the current 1237-line
`api-reference.md` shows is intentional — these are not auto-generated
descriptions). Revisit when the API surface stabilises post-1.0.

---

## 7. Phasing recommendation

### What fits in B84 Phase 2

Phase 2 is the docs route. Three implementation cards, in order.

#### Card 1 (file first): **B96 — Docs primitive library + chrome + landing**

- **Scope**: Build the v1 primitive library (`<DocPage>`, `<InstallBlock>`,
  `<SignatureBlock>`, `<ParameterTable>`, `<Playground>` rebadge of
  existing `SchemaPlayground`, `<SpeedClaim>`, `<DefRef>`,
  `<RelatedShowcase>`, `<Prerequisites>`) in `site/src/lib/docs/widgets/`,
  each with a `.stories.svelte`. Build the `/docs` landing page
  (replaces the current redirect) as a card-grid of doc sections using
  `<DocPage sidebarGroup="index">`. Build `/docs/+layout.svelte` with the
  sidebar driven by a typed `site/src/lib/docs/sidebar.ts` manifest
  (Concepts / Reference / Guides / How-to). Delete
  `site/content/docs/*.md` and the `import.meta.glob` page. Stub all
  other doc routes as placeholders linking to the canonical
  `docs/*.md` (preserves D5 until each route is rebuilt in subsequent
  cards). Add `data-pagefind-*` attributes to the chrome to prime
  search.
- **Acceptance**: `/docs` renders the new landing. Sidebar visible. All
  v1 primitives have a Storybook story. `pnpm validate` green. D17/D20:
  any `<SpeedClaim>` without `source` fails to type-check (proven by a
  failing test). D18 successor rule logged in `wiki/decisions.md` +
  `wiki/architecture.md` Rules.

#### Card 2: **B97 — Rebuild Getting Started + Concepts on the new primitives**

- **Scope**: Author
  `site/src/routes/docs/getting-started/+page.svelte` and
  `site/src/routes/docs/concepts/+page.svelte` as bespoke pages using
  the primitives. Port prose from `docs/getting-started.md` /
  `docs/concepts.md` (these files stay canonical in `docs/`; the site
  versions reuse the prose verbatim per the §6 hand-authored
  convention). Each page emits ≥1 `<Playground>` and ≥1
  `<RelatedShowcase>` to `/showcase` or `/explorer`. The Getting
  Started page leads with `<InstallBlock>` and a `<SpeedClaim
  source="…/latest.json" />` callout (D17/D20).
- **Acceptance**: Both routes render. Pagefind indexes them (build
  emits a Pagefind index). Manual visual check on Phosphor + Paper
  palettes. `pnpm validate` green.

#### Card 3: **B98 — Structured API reference + `docs:generate` parity guard**

- **Scope**: Build `site/src/lib/docs/api/manifest.ts` covering every
  symbol currently in `docs/api-reference.md`'s "Exports overview"
  table (~25 symbols). Build `site/src/routes/docs/api/+page.svelte`
  as a typed-driven structured view (right-rail TOC + per-symbol
  `<SignatureBlock>` cards). Build `scripts/docs-generate.ts` that
  reads the manifest and emits `docs/api-reference.md`; add
  `pnpm docs:generate` + `pnpm docs:check` to root scripts. Wire
  `docs:check` into `pnpm validate`. Rewrite D5 in
  `wiki/decisions.md` + `wiki/architecture.md` to refer to the
  manifest as the entry point. Update CLAUDE.md to match.
- **Acceptance**: `/docs/api` renders structured. Running
  `pnpm docs:generate` produces the existing `docs/api-reference.md`
  byte-for-byte (with reasonable formatting tolerance — the script's
  template is the new canonical shape, so the committed
  `docs/api-reference.md` is the first generated output of this
  card). `pnpm docs:check` passes in CI. A negative test: introduce
  a manifest change without regenerating, run `pnpm docs:check`,
  verify it fails with a useful diff. D5 rule updated.

### What defers to follow-up cards (post-Phase 2)

| Item | Defer reason | Suggested card |
| --- | --- | --- |
| `<DocPage>`-ify `key-heuristics`, `recipes`, `zod4-schema-coverage`, `bugs` | Three more pages to build; B97/B98 unlock the pattern. | B99 — port remaining docs pages to the new primitives. |
| Pagefind index + UI integration | Land in B97 (the first page that benefits from search) — but the search box UI lives in `Nav`, which Phase 1 owns; coordinate. | B100 — Pagefind search UI in Nav. |
| Command palette (⌘K) | Defer until Pagefind is in. | B101 — command palette over Pagefind + API manifest. |
| Type-aware code blocks (Monaco / Volar) | Heavy build; defer until justified. | B102 (when justified). |
| Inline `/explorer` slice in a doc page | Blocks on Phase 4a (`world.trace()`). | Fold into B90 (Explorer widgets) — that card already builds the reusable embed. |
| Version selector | Pre-1.0; punt. | B103 (1.x milestone). |

### How the phases plug back into B84's plan

B84's §10 phasing said: Phase 1 (foundation, **shipped — B95**), Phase 2
(docs), Phase 3 (comparison + bench), Phase 4 (Explorer), Phase 5 (polish).
**This report replaces B84 §5 and resets Phase 2 to the three cards above
(B96 → B97 → B98).** Phase 3, 4, 5 are unaffected. Phase 1 → Phase 3 → Phase
4 → Phase 5 remain unblocked by Phase 2 (Phase 2 ships in parallel), per the
gating B84 §9 already records.

### Constraint conformance

| Rule | How this design satisfies it |
| --- | --- |
| **D5** | The structured API page (`site/src/lib/docs/api/manifest.ts`) is the new D5 entry point; `docs/api-reference.md` is regenerated by `pnpm docs:generate` and verified by `pnpm docs:check` (CI). The other `docs/*.md` files remain canonical and hand-edited; the corresponding site pages reuse their prose. Reviewer's standing check: "manifest changed if and only if the published API changed" + "`pnpm docs:check` passes". |
| **D17** | `<SpeedClaim>` primitive **requires** a `source` prop (TS type `{ source: string }` — no default). Any speed claim without citation fails to compile. The CLI baseline path (`site/bench/results/latest.json`) is the canonical `source` value, asserted by a build-time test that resolves the path string. |
| **D18** | mdsvex remains the renderer for `+page.md` doc pages — D18 unchanged for those. For bespoke `+page.svelte` doc pages, the **successor rule** (logged in B96) applies: "Any docs primitive that mounts an editor MUST defer to `onMount` and MUST NOT touch `window`/`document` at module load. `<Playground>` is the reference implementation." |
| **D19** | Every `/docs/<slug>/+page.svelte` is a fully prerendered SvelteKit route — search-landed visitors arrive on a complete page, no client-side route fetch required. The homepage's job (`/`) is untouched; D19 is preserved. |
| **D20** | Same primitive as D17 — `<SpeedClaim source=…>` forces honest framing at the type level. The reviewer no longer needs to grep for "fastest"; the type system rejects it. |

---

## Recommendation

Build the docs as a **first-class SvelteKit `/docs/*` route tree** under
`site/src/routes/docs/`, authored from typed `+page.svelte` modules that
import a small set of **first-class doc primitives** layered on
`@dxlbnl/ui` (`<DocPage>`, `<SignatureBlock>`, `<ParameterTable>`,
`<Playground>`, `<InstallBlock>`, `<SpeedClaim>`, `<DefRef>`,
`<RelatedShowcase>`, `<Prerequisites>`). Keep `docs/api-reference.md`
shipping in the npm tarball, but **generate it from
`site/src/lib/docs/api/manifest.ts`** via a `pnpm docs:generate` script;
verify parity in CI with `pnpm docs:check`. Wire **Pagefind** over the
prerendered routes for search. **Reject Astro Starlight** (forks the
design system, breaks `<Playground>` embedding) and **reject the flat
`docs/*.md` render** (already rejected by maintainer). The result: a
docs surface that earns the library — structured navigation, interactive
primitives, honest speed claims by construction, a single tractable
sync point with the npm tarball — and a Phase 2 plan that ships in three
cards without blocking Phases 3 / 4 / 5.

### Follow-up cards (manager files in order)

1. **B96 — Docs primitive library + chrome + landing**: build the v1
   primitive set (`<DocPage>`, `<Playground>`, `<SignatureBlock>`,
   `<ParameterTable>`, `<InstallBlock>`, `<SpeedClaim>`, `<DefRef>`,
   `<RelatedShowcase>`, `<Prerequisites>`), the `/docs` landing,
   `/docs/+layout.svelte` with typed sidebar manifest, delete
   `site/content/docs/`, log D18 successor rule.
2. **B97 — Rebuild `/docs/getting-started` + `/docs/concepts` on the new
   primitives**: port prose, embed `<Playground>`, `<InstallBlock>`,
   `<SpeedClaim>` (D17/D20-clean), `<RelatedShowcase>` cross-links.
3. **B98 — Structured `/docs/api` + `docs:generate` parity guard +
   D5 rewrite**: build `site/src/lib/docs/api/manifest.ts`,
   `/docs/api/+page.svelte`, `scripts/docs-generate.ts`,
   `pnpm docs:check` in CI, update D5 in `wiki/decisions.md` +
   `wiki/architecture.md` to point at the manifest.
4. **B99 — Port remaining docs pages** (`key-heuristics`, `recipes`,
   `zod4-schema-coverage`, `bugs`): same primitive set.
5. **B100 — Pagefind search UI in `Nav`**: index emission + search box.
6. **B101 — Command palette (⌘K) over Pagefind + API manifest**: thin
   wrapper, Linear-style.

(B102 type-aware code blocks and B103 version selector remain deferred;
file when justified.)

---

## See also

- [B94 — Docs system design](../../backlog/doing/B94-docs-system-design.md) — the card this report answers.
- [B84 — Site architecture rebuild](../../backlog/doing/B84-site-architecture-rebuild.md) — §5 is replaced; §10 phasing absorbs cards B96–B101.
- [wiki/decisions.md](../../decisions.md) — D5, D17, D18, D19, D20; this report proposes amendments to D5 (manifest entry point) and D18 (successor rule for `+page.svelte` editors).
- [wiki/architecture.md](../../architecture.md) — Rules section; same.
- [wiki/site/architecture.md](../../site/architecture.md) — site stack (SvelteKit 2 + mdsvex + Shiki + Chart.js + CodeMirror); mdsvex stays in service of `+page.md` routes that prefer prose.
- [docs/api-reference.md](../../../docs/api-reference.md) — the 1237-line canonical reference; becomes a regenerated artefact under B98.
- [site/src/routes/docs/](../../../site/src/routes/docs/) — the route tree this report restructures.
