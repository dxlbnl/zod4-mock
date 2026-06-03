# Wiki Index

**This wiki is the single source of truth for the project. It is the spec.**
Every agent reads this page first, before doing anything else.

## How the workflow uses this wiki

- The `manager` reads `backlog/` to decide what to build next, dispatching on each
  item's `type:` (feature / bug / research / chore).
- `spec-writer` turns a feature/bug backlog item into a testable spec page under
  `specs/`.
- `test-writer` writes failing tests from that spec page; `implementer` makes them
  pass; `reviewer` verifies the result against this wiki.
- When code and wiki disagree, the **wiki wins** — update the wiki (or run `/wiki-sync`).

## Pages

| Page                               | Purpose                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [vision.md](vision.md)             | What the project is and why it exists.                                                                                                                 |
| [requirements.md](requirements.md) | Functional requirements and constraints.                                                                                                               |
| [architecture.md](architecture.md) | Tech stack, package manager, test setup, structure, and the binding **Rules** index.                                                                   |
| [codebase-map.md](codebase-map.md) | Internal `src/` layout — file-by-file roles, the two generator axes (key-based vs schema-based), and the engine.                                       |
| [backlog/](backlog/)               | Work items, arranged in four lanes (inbox → ready → doing → done). See `backlog/README.md`.                                                            |
| [decisions.md](decisions.md)       | Append-only ADR log of standing constraints (each ADR pairs with a one-line rule in `architecture.md`).                                                |
| [progress.md](progress.md)         | Append-only run journal — what the agents have done.                                                                                                   |
| [specs/](specs/)                   | One spec page per feature/bug (`B<n>-<slug>.md`). Browse the directory; format in `specs/README.md`.                                                   |
| [research/](research/overview.md)  | Research reports grouped by topic (`engine/`, `text-generation/`, `reports/`). Start at `research/overview.md`; live status in `research/tracking.md`. |
| [site/](site/)                     | Site (homepage / `/bench` / `/showcase` / `/docs`) design notes, benchmark methodology, roadmap, and historical backlog/log from the gen-bench merge.  |

> **End-user documentation lives in `docs/`** (`docs/api-reference.md`,
> `docs/getting-started.md`, `docs/concepts.md`, `docs/key-heuristics.md`,
> `docs/recipes.md`, `docs/zod4-schema-coverage.md`), not in this wiki. This wiki is the
> build-time source of truth; `docs/` is the shipped reference. Per the doc rule in
> `architecture.md`, public API changes update `docs/api-reference.md` in the same step.

> The wiki is **open-ended**. Only this `INDEX.md` is structurally required. Add, split,
> and restructure pages as the project grows.

## Conventions

- **Adding a structural page** — create `wiki/<name>.md` and add a row to the Pages
  table above. The table lists **structural** pages only (entry points, indexes).
- **Spec and research pages** are discovered by **browsing** their directories
  (`specs/`, `research/<topic>/`), not by enumeration here. Don't add a per-item row
  to the Pages table.
- **Backlog items**: live as per-item files under `wiki/backlog/<lane>/B<n>-<slug>.md`.
  Lane = directory (no `status:` field). Each item has a `type:` (feature / bug /
  research / chore) and an optional `flags:` list (`review` to pause for approval,
  `blocked` if stuck). File new work with `/intake`; see `backlog/README.md`.
- **Spec pages**: live in `specs/`, one per feature/bug, named after the backlog item
  (e.g. `B3-user-login.md`). Specs **MUST** state requirements with stable IDs, one
  RFC-2119 keyword each, and ≥1 `GIVEN/WHEN/THEN` scenario per requirement; a **blocking**
  open question **MUST** flag the item `review`. See `specs/README.md`.
- **Decisions & rules**: a choice that establishes a **standing constraint** (something
  future work must obey) is logged in `decisions.md` (the rationale, ADR-style) **and**
  appears as a one-line rule in `architecture.md`'s Rules section — the binding index
  agents read before coding, maintained by the manager. Local, one-off choices go in
  `progress.md`, not `decisions.md`.
- **Progress**: the `manager` appends to `progress.md` as items move through the
  pipeline, so the run is auditable.
