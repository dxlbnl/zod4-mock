# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Library:**

```bash
pnpm typecheck       # type-check
pnpm lint            # lint code
pnpm test            # run all tests
```

**Playground:**

```bash
pnpm check           # svelte-check
pnpm test:unit       # playground unit tests
pnpm test:component  # playground component tests
```

## Rules of Engagement

- **Scratch Files**: **NEVER** create scratch files.
- **Technical**: **NEVER USE `any`**.
- **Browsing**: Always use codesearch tools (e.g., `grep_search`) for browsing data.
- **Efficiency**: Only check relevant files for the given task.
- **Preparation**: Before starting any task, check the README and Wiki.
- **Testing**: Always write a test or component test when necessary.
- **Bugs**: If fixing a bug, always create a regression test.

## Architecture

This is a library (`zod4-mock`) that generates deterministic, schema-driven mock data from Zod v4 schemas. The public API is exported from [src/index.ts](src/index.ts).

### Core concepts

**World** — the central context for one generation session ([src/world.ts](src/world.ts)). Built fluently with `.withSubject()` and `.withSchema()`, then data is produced via `.generate()`. One world = one seed = one deterministic dataset.

**SubjectType** — an identity anchor representing a domain entity (Person, Company, TextFile, etc.). Defined with `defineSubjectType(name, zodObjectSchema)` ([src/subject.ts](src/subject.ts)). Subject instances get stable IDs (`person#1`, `person#2`, …) and their data is stored in the registry so matchers in other schemas can reference it.

**Generation pipeline** — for each field of a registered schema, values are resolved in this order:

1. **Matchers** (explicit functions provided in `world.withSchema(..., matchers)`)
2. **Key-based generators** — field name heuristics (e.g. `email`, `firstName`, fields ending in `id`) ([src/generators/key-based.ts](src/generators/key-based.ts))
3. **Schema-based generators** — Zod type introspection (string, number, enum, object, array, etc.) ([src/generators/schema-based.ts](src/generators/schema-based.ts))
4. `overrides` — deep merge after generation
5. `transform` — final transform function

**PRNG** — Mulberry32 seeded PRNG with FNV-1a hashing for per-field `fork(key)` derivation ([src/prng.ts](src/prng.ts)). Per-field seeding means adding/removing schema fields does not disturb values for other fields. The `Prng.fork(key)` method creates an independent child PRNG without consuming the parent's state.

**Registry** — in-memory store for all generated data within a world ([src/registry.ts](src/registry.ts)). Matchers can call `ctx.registry.pick<T>('typename')` to reference data generated for other subject types, enabling cross-API consistency.

### Zod v4 internals

Zod v4 stores schema definitions at `schema._zod.def` (not `schema._def` as in v3). Checks are class instances accessed via `check._zod.def`. The codebase accesses these directly via type-casting — this is intentional since Zod v4 doesn't expose a stable public introspection API.

### Test structure

- `tests/unit/` — isolated unit tests for each module
- `tests/integration/` — three full-scenario integration tests (document-corpus, invoicing, media-library), each with its own `schemas.ts` and `world.ts`. The media-library test demonstrates multi-subject, cross-API consistency.

### Documentation rule

**Whenever a public API changes — new method, removed method, changed signature, or changed behaviour — update `docs/api-reference.md` in the same step.** Do not defer documentation to a follow-up; it will be forgotten.

### TypeScript strictness

The `tsconfig.json` enables `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Array indexing always returns `T | undefined`, requiring `!` assertions or null checks. All imports use `.js` extensions (Node16 ESM module resolution).

---

# Vibin — operating rules

> **Docs vs. wiki:** end-user documentation (API reference, concepts, getting started,
> key heuristics, recipes, schema coverage) lives in `docs/`. The `wiki/` below is the
> Vibin workflow's single source of truth for *building* the project (vision,
> requirements, architecture/Rules, backlog, specs). Generator-overhaul research lives
> in `wiki/research/better-gen/`.

This repo has adopted the **Vibin** seed: a **wiki-driven, spec-driven, test-first**
multi-agent workflow. These rules are enforced by hooks in `.claude/` and by the agent
and skill definitions in `.claude/agents/` and `.claude/skills/`.

## The wiki is the single source of truth

- `wiki/` is the spec. Detailed feature specs live in `wiki/specs/` as wiki pages —
  there is no separate specs directory.
- **Every agent reads `wiki/INDEX.md` first.** A `PreToolUse` hook enforces this so it
  cannot be skipped; if the wiki has changed since you last read it, re-read the
  affected pages before continuing.
- The wiki is open-ended. Only `INDEX.md` is structurally required; add, split, and
  restructure other pages freely, and link them from `INDEX.md`.
- When code diverges from the wiki, **update the wiki** (or run `/wiki-sync`). The
  `PostToolUse` reminder will nudge you.

## Workflow

1. `/bootstrap` interviews the user, populates the `wiki/` starter pages, scaffolds the
   chosen stack, writes the stack-specific permission profile into
   `.claude/settings.json`, and hands off to the `manager` skill.
2. The top-level session runs the `manager` skill: it reads the wiki + the items in
   `wiki/backlog/{inbox,ready}/`, commits the bootstrap baseline (the scaffold +
   populated wiki) on its first run, presents an ordered work plan for approval, then
   for each item dispatches the right track based on the item's `type:`:
   - `feature` → `spec-writer` → `test-writer` → `implementer` → `reviewer`
   - `bug` → same as feature, plus a regression test for the reported failure
   - `research` → `researcher` specialist → reviewer confirms findings
   - `chore` → `implementer` → `reviewer` (no spec, no tests-first)
   - a `feature`/`bug` with `mode: lite` → `implementer` → `reviewer (lite)` (no spec, no
     tests-first) **when it passes the lite gate** (see Operational rules → Lite track)
3. **Tests are always written first** for **full** `feature`/`bug` items. `test-writer`
   writes failing tests from the spec page and confirms red; `implementer` writes the
   minimum code to reach green. (A gate-passing `mode: lite` item is behavior-neutral, so
   there is nothing to assert and no test is written.)
4. An item is **done** when the reviewer passes AND the full test suite is green. The
   manager `git mv`s the item file to `wiki/backlog/done/`, commits one commit per
   completed item (no push), and loops.

## Operational rules

- **Top-level boundary** — the top-level session answers questions, runs `/bootstrap`,
  and runs the `manager` skill to orchestrate the build. Orchestration lives at the top
  level because only the top-level session can spawn subagents. Even so, the top-level
  session never writes product code, specs, or tests itself — every such artifact goes
  through a delegated subagent.
- **Artifact handoff** — subagents do not share a conversation. They communicate only
  through repo + wiki artifacts. Delegation prompts must name the exact files to read
  and write.
- **Triage** — any bug report, feature request, or change of direction surfaced
  mid-run becomes a new item in `wiki/backlog/inbox/` via `/intake`. Never inline-patch
  in response. The capturing agent files the item, tells the user, and continues the
  current item. The only exception is a trivial typo/comment fix adjacent to the
  current item, which is folded into the current item's commit. An **answer to an open
  question** on the current item (including a decision a specialist needs) is *not* new
  work: it is folded into that item's spec (re-dispatch `spec-writer`), never filed via
  `/intake`.
- **Lite track** — a `feature`/`bug` may carry `mode: lite` to skip the spec page and
  tests-first (`implementer` → `reviewer (lite)`), but **only** for a gate-passing,
  behavior-neutral product change: ≤ a handful of files, no new dependency, no schema/API/
  contract change, nothing security-sensitive, and nothing observable that warrants a test.
  The manager re-checks the gate before honoring lite and **auto-promotes to full** if the
  change turns out bigger. A `bug` that fixes real behavior is always full. Lite is never a
  tests-first bypass for real behavior; `chore` is non-product work, `lite` is trivial product
  work.
- **UI verification** — opt-in per project (frontend stacks, enabled at `/bootstrap`) and
  dormant otherwise. A spec's `Scenario (UI):` entries are verified in a real browser via a
  **proper tool** — a committed **Playwright** test and/or the **Chrome DevTools MCP** (the
  reviewer drives the running app + captures a screenshot) — **never** ad-hoc `node`/`python`
  browser scripts.
- **Search with tools, not Bash** — inspect code with the `Grep`/`Glob`/`Read` tools, never
  shelled `grep`/`find`/`rg`/`cat`/`head`/`sed`. The tools are auto-allowed and silent; a
  shelled-out search makes the user approve a permission prompt. Reserve Bash for the project's
  own commands (test runner, `git`) and run them **one per call** — chaining with `;`/`&&`
  usually won't match the permission allowlist as a single prefix, so it prompts too.
- **No ad-hoc `node`/`python` invocations** — agents must not run `node -e ...`,
  `node <oneoff.js>`, `python -c ...`, `python <oneoff.py>`, or similar interpreter
  scripts as ad-hoc investigation or probing tools. The right tool for each pattern:
  - Searching or inspecting code → `Read` / `Grep` / `Glob` (not a node script).
  - Inspecting data files (JSON, CSV, logs) → `Read` (and `jq` via Bash if needed).
  - Probing an external API to check it works → describe the request (curl / fetch /
    endpoint + body) and **ask the user** to run it.
  - Verifying behaviour of the system being built → write a real test through the
    `test-writer` / `implementer` flow, not a throwaway invocation.
  - Mutating environment, CI, build, or local-tool configuration → describe the
    change (file path + exact diff or shell command) and **ask the user** to apply it.
    Committing a config *file* the project owns — `vite.config.ts`, `pyproject.toml`,
    `Dockerfile`, a CI workflow yaml — is fine; that's product code.

  **Exception**: project-owned commands (`pnpm run …`, `pytest`, `tsc --noEmit`,
  `cargo test`, or a script the project has committed) are fine — those are the
  project's normal operations, not ad-hoc agent work.
- **Package manager** — always use the one declared in `wiki/architecture.md`. Do not
  substitute another even if generated configs, READMEs, or model priors suggest one.
  If the declaration is missing or ambiguous, defer to the user.
- **Run until blocked** — the manager works through the backlog without per-item
  check-ins, pausing only on one of three things:
  1. A **review checkpoint** (the initial work plan, or any item flagged `review`).
  2. An **unresolved failure** (retry budget exhausted — see below).
  3. A **reviewer escalation** (second rejection on the same item).
- **Review checkpoints** — the manager pauses and asks the user directly for approval
  for: (1) the initial work plan, always; (2) any item flagged `review` in its card
  frontmatter (`flags: [review]`). Items are flagged by the user or auto-flagged by the
  manager when risky/ambiguous/architecturally significant. Unflagged items never pause.
- **Retry / escalation** — `implementer` gets 3 attempts inside its own loop to reach
  green. If still red, the manager routes the failure context back for one more
  attempt (4th total), then escalates to the user. A `reviewer` rejection loops back to
  `implementer` once with the review notes; a second rejection escalates.
- **Resuming and unblocking** — to resume after a pause, run `/manager` (or `/status`
  to inspect first). To skip an escalated item, edit its frontmatter to add
  `flags: [blocked]` and a one-line reason in `## Notes`, then re-run `/manager`. To
  cancel, `git mv` the item to `wiki/backlog/done/` and add `flags: [cancelled]`.
- **Commits** — one commit per completed item, message references the backlog item id
  (e.g. `B3: add user login`). Never push unless the user asks.
- **Resumability** — the manager's durable state is `wiki/backlog/**` +
  `wiki/progress.md`. A fresh `/manager` invocation reads those and continues.
- **Decisions and rules** — a choice that establishes a **standing constraint**
  (something future work must obey — a dependency/tool, a pattern, an architectural
  boundary) is logged to `wiki/decisions.md` (ADR-style rationale) by the agent that made
  it, *and* surfaced as a one-line RFC-2119 rule in `wiki/architecture.md`'s **Rules**
  section — the binding index agents read before coding. The **manager owns** the Rules
  section: subagents write the rationale and flag the constraint, the reviewer confirms a
  decision exists, and the manager promotes it to a rule when the item is done. Local,
  one-off choices go in `progress.md`, not `decisions.md`.
- **Escalation is visible** — when the manager pauses or escalates, it writes the reason
  to `wiki/progress.md` and states it in chat.
- **Specialist agents** — beyond the four pipeline subagents, the manager may spawn
  ad-hoc `general-purpose` specialists (researcher, security-auditor, designer, …) or
  persist recurring ones as `.claude/agents/*.md`. All specialists obey the same rules:
  read the wiki first, hook-gated, artifact handoff.
