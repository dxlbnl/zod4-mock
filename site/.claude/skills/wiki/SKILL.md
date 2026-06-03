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
- `wiki/architecture.md` — stack, test setup, project structure, key decisions.
- `wiki/backlog.md` — prioritized work items.
- `wiki/decisions.md` — append-only ADR-style decision log.
- `wiki/progress.md` — append-only run journal kept by the manager.
- `wiki/specs/` — one detailed, testable spec page per feature.

The wiki is **open-ended**. Only `INDEX.md` is structurally required — add, split, and
restructure other pages freely.

## Conventions

- **Adding a page** — create `wiki/<name>.md` (or `wiki/specs/<feature>.md`) and add a
  row to the Pages table in `INDEX.md` so it is discoverable. An unlinked page is an
  invisible page.
- **Backlog items** — each has a status (`todo` / `in-progress` / `done`) and an
  optional `review` flag (pause for user approval after the spec, before
  implementation). The user flags items; the manager may auto-flag risky ones.
- **Spec pages** — live in `wiki/specs/`, one per backlog item, following the format in
  `wiki/specs/README.md`. Acceptance criteria must be **testable**.
- **Decisions** — never edit a past entry in `decisions.md`; supersede it with a new
  one. Any agent making a notable design/tech choice appends an entry.
- **Progress** — the manager appends to `progress.md`; treat it as an audit log.

## After the wiki changes

The wiki-gate hook keys each actor's "I've read the wiki" marker against the newest
wiki file. When you change the wiki, other actors' markers go stale and they must
re-read before continuing — this is intentional, so everyone builds from the current
spec.
