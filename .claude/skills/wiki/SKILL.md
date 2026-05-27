---
name: wiki
description: Conventions for reading and maintaining the Vibin wiki — the single source of truth. Use when adding or editing wiki pages, organizing the wiki, or when unsure how the wiki is structured.
disable-model-invocation: false
---

# Working with the Vibin wiki

The `wiki/` directory is the **single source of truth and the spec**. Code serves the
wiki, not the other way around. When code and wiki disagree, the wiki wins (or you fix
the wiki deliberately — see `/wiki-sync`).

## Structure

- `wiki/INDEX.md` — the **required** entry point. Every agent reads it first; the
  wiki-gate hook enforces this. It holds the Pages table and the conventions.
- `wiki/vision.md` — what the project is and why.
- `wiki/requirements.md` — functional requirements, constraints, assumptions, open
  questions.
- `wiki/architecture.md` — stack, **binding package manager**, test setup, project
  structure, and the binding **Rules** index (standing constraints, derived from
  `decisions.md`, that agents read before writing code).
- `wiki/backlog/` — work items, one per file, arranged in four lanes:
  `inbox/` → `ready/` → `doing/` → `done/`. See `wiki/backlog/README.md` for the
  schema, lane semantics, and the per-`type:` track table.
- `wiki/decisions.md` — append-only ADR-style decision log.
- `wiki/progress.md` — append-only run journal kept by the manager.
- `wiki/specs/` — one detailed, testable spec page per feature/bug item, paired with
  an item card via the card's `spec:` frontmatter.

The wiki is **open-ended**. Only `INDEX.md` is structurally required — add, split, and
restructure other pages freely.

## Conventions

- **Adding a page** — create `wiki/<name>.md` (or `wiki/specs/<feature>.md`) and add
  a row to the Pages table in `INDEX.md` so it is discoverable. An unlinked page is
  an invisible page.
- **Backlog items** — each is its own file at `wiki/backlog/<lane>/B<n>-<slug>.md`.
  Lane = directory (no `status:` field). Each item has a `type:`
  (`feature`/`bug`/`research`/`chore`) which selects the manager's track, and an
  optional `flags:` list (`review` to pause for approval; `blocked` if stuck, with
  a one-line reason in `## Notes`). File new work with `/intake`. The manager moves
  items between lanes via `git mv` — never copy-and-delete (the rename preserves
  history).
- **Spec pages** — live in `wiki/specs/`, one per feature/bug item, following the
  format in `wiki/specs/README.md`. Each spec **MUST** state its requirements with
  stable `B<n>-R<k>` IDs, exactly one RFC-2119 keyword per requirement, and **≥1**
  `GIVEN/WHEN/THEN` scenario each (one scenario → one test). A **blocking** open question
  **MUST** flag the item `review` and stops it advancing to tests. The spec page is
  linked from its item card via the `spec:` frontmatter.
- **Decisions & rules** — `decisions.md` is the append-only rationale archive: never edit
  a past entry, supersede it with a new one and link both. An entry belongs there only if
  it establishes or changes a **standing constraint** (something future work must obey);
  local one-off choices go in `progress.md`. Every standing-constraint decision is also
  surfaced as a one-line rule in `architecture.md`'s **Rules** section — the binding index
  agents read before coding. The **manager owns** that Rules section: subagents write the
  rationale to `decisions.md` and flag the constraint, the reviewer confirms the decision
  exists, and the manager promotes it to a rule when the item is done.
- **Progress** — the manager appends to `progress.md`; treat it as an audit log. Use
  `/status` for a one-screen summary of where the pipeline is right now.

## Package manager (binding)

`wiki/architecture.md` declares **the** package manager for the project (e.g. pnpm
for a TypeScript project, uv for Python). All agents use only that one — they do not
substitute another even if generated configs or tutorials reference one. If the
declaration is missing, agents stop and ask the user.

## After the wiki changes

The wiki-gate hook keys each actor's "I've read the wiki" marker against the newest
wiki file. When you change the wiki, other actors' markers go stale and they must
re-read before continuing — this is intentional, so everyone builds from the current
spec.
