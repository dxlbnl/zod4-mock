# Backlog

The backlog is a directory of **per-item files** arranged in four lanes. Lane = the
subdirectory the item file lives in. Items move from `inbox/` → `ready/` → `doing/` →
`done/` via `git mv` (which preserves history).

## Lanes

| Lane | Meaning |
|---|---|
| `inbox/` | Captured but not yet scoped. New items land here. |
| `ready/` | Has the artifact its track needs to start work (spec for features/bugs; clear question for research; clear ask for chores). The manager pulls from here. |
| `doing/` | Currently being worked. The manager moves at most one item here at a time. |
| `done/` | Reviewer passed and the full test suite is green (one commit made). |

## Item card format

One file per item: `wiki/backlog/<lane>/B<n>-<slug>.md`.

```markdown
---
id: B3
title: User login
type: feature           # feature | bug | research | chore
priority: high          # high | medium | low
flags: [review]         # optional; review = pause for approval, needs-answers = awaiting user answers, blocked = stuck
mode: lite              # optional (feature/bug); lite = trivial behavior-neutral change, skip spec + tests-first. Omit for full (default)
created: 2026-05-14
spec: wiki/specs/B3-user-login.md   # populated once the spec page exists
---

## Description
<one paragraph in the user's voice — the "why" and rough "what">

## Notes
<links, gotchas, history — agents append here as work progresses>
```

For non-feature items, replace `spec:` with the artifact path the track produces (e.g.
`report: wiki/research/<topic>.md`).

## Tracks (the manager dispatches on `type:`)

| Type | Track |
|---|---|
| `feature` | `spec-writer` → `test-writer` → `implementer` → `reviewer` |
| `bug` | same as `feature`, plus `test-writer` MUST add a regression test for the reported failure; `reviewer` confirms it |
| `research` | `researcher` specialist → `wiki/research/<topic>.md` → `reviewer` confirms findings answer the question |
| `chore` | `implementer` → `reviewer` (no spec, no tests-first) — dep bumps, doc reorgs, infra |

A `feature`/`bug` with **`mode: lite`** runs a lighter track — `implementer` →
`reviewer (lite)`, no spec page, no tests-first — when it passes the lite gate below.

New project-specific types: declare in `wiki/decisions.md` and extend the manager skill.
Unknown type: manager asks the user.

## Lite mode (`mode: lite`)

For a **small, behavior-neutral product change** (a copy fix, a CSS tweak, a trivial config
change) the full spec→tests→review ceremony is overkill — there's nothing to assert. Such an
item may carry `mode: lite` to skip the spec page and tests-first; its contract is the card's
`## Description` plus a one-line acceptance note.

**Lite gate — `mode: lite` is honored only if ALL hold:**
- touches **≤ ~a handful of files** and adds **no new dependency**;
- makes **no schema, API, or public-contract change**;
- introduces **no new observable behavior that warrants a test**;
- is **not security-sensitive** (auth, secrets, input handling, permissions).

If any fails → **full**. When in doubt → **full**. A `bug` that fixes real behavior is
**always full** (it needs a regression test). The manager **re-checks this gate** before
honoring lite and **auto-promotes to full** if a change turns out bigger; lite is never a
tests-first bypass for real behavior.

**`chore` vs `lite`:** `chore` is *non-product* work (dep bumps, infra, doc reorgs); `lite` is
a *trivial product* change that's behavior-neutral. Keep them distinct.

## Conventions

- **Filing new work** — run `/intake "<title>"`. It writes the item into `inbox/`. The
  manager ranks/triages later. Never inline-patch a mid-run report — file it.
- **Moving an item** — use `git mv wiki/backlog/<from>/<file> wiki/backlog/<to>/`. Don't
  copy-and-delete; the rename preserves git history.
- **Flags** —
  - `review` — pause for user approval after the spec/artifact is ready, before work.
    The user sets this; the manager may auto-add it for risky/ambiguous items.
  - `needs-answers` — the item is waiting on the user to answer **blocking** open questions
    written in its `## Open questions`. The manager bounced the card to `inbox/` and keeps
    working other items; it never silently advances. **To resume:** write your answers on
    the card and clear this flag (or move it to `ready/`); the manager then folds the
    answers into the draft spec and continues.
  - `blocked` — work cannot proceed; include a one-line reason in the `## Notes` body.
- **Ordering** — `priority: high` items are pulled first. Within a priority, oldest
  `created:` first.
- **Done** — the manager `git mv`s the item to `done/` after the reviewer passes and the
  full suite is green, then commits the item's files in a single commit referencing the
  id (e.g. `B3: add user login`).

## See also

- `/intake` — file a new item.
- `/status` — show current lane counts, the active item, and the next ready items.
- `wiki/specs/README.md` — the spec page format that pairs with feature/bug items.
