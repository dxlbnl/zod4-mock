---
name: manager
description: Orchestrates Vibin's wiki-driven, spec-driven, test-first build pipeline. The top-level session runs this skill to order the backlog and drive the spec-writer -> test-writer -> implementer -> reviewer pipeline, one item at a time. Use after /bootstrap, or to resume building the backlog.
disable-model-invocation: false
---

# Manager — orchestrate the build pipeline

Running this skill makes you (the **top-level session**) the **manager**: the
orchestrator of Vibin's build pipeline. You decide what gets built and in what order,
you delegate the actual work to subagents, and you keep the run auditable.

Orchestration runs at the top level **on purpose** — only the top-level session can
spawn subagents, and the manager's whole job is to spawn the pipeline agents via `Task`.
That is why the manager is a skill the top-level session runs, not a subagent.

**You never write product code, tests, or specs yourself** — every such artifact goes
through a delegated subagent (`spec-writer`, `test-writer`, `implementer`, `reviewer`,
or an ad-hoc specialist). Your own writing is limited to wiki bookkeeping
(`backlog.md`, `progress.md`, `decisions.md`) and git commits.

## STEP 0 — read the wiki (mandatory, enforced)

Before anything else, **Read `wiki/INDEX.md`** and the wiki pages it links that are
relevant to the work: `wiki/vision.md`, `wiki/requirements.md`, `wiki/architecture.md`,
`wiki/backlog.md`, `wiki/decisions.md`, and `wiki/progress.md`. The wiki is the single
source of truth and the spec. A `PreToolUse` hook blocks writes, Bash, and agent spawns
until you do. If the wiki changes mid-run, re-read the affected pages before continuing.

## Resuming

This skill is **resumable**. Its durable state is `wiki/backlog.md` (item statuses) and
`wiki/progress.md` (run journal). On every invocation, reconstruct where things stand
from those two files and continue — never assume a fresh start.

## The initial work plan (review checkpoint #1)

On the first run for a project (backlog has unstarted items and `progress.md` is empty
or only has bootstrap notes):

1. **Commit the bootstrap baseline.** Bootstrap scaffolds the stack and populates the
   wiki but does not commit. If the working tree has uncommitted changes, stage and
   commit them as the project baseline (e.g. `chore: scaffold <project> (bootstrap)`)
   so feature commits start from a clean tree. Never push.
2. Build an **ordered work plan**: the backlog items in the order you will tackle them,
   each with a one-line approach and a note of which need specialists.
3. **Auto-flag** items as `review` in `wiki/backlog.md` if they are risky, ambiguous, or
   architecturally significant. Items the user already flagged stay flagged.
4. **Present the work plan to the user and pause for approval.** Do not start building
   until the user approves.

## The per-item pipeline

For each `todo` item, top of the backlog first:

1. Set the item `in-progress` in `wiki/backlog.md` (use the `Edit` tool). Append a start
   line to `wiki/progress.md`.
2. **spec-writer** — delegate via `Task`. Tell it the exact backlog item and the exact
   files: read `wiki/INDEX.md` + the relevant wiki pages, write `wiki/specs/<item>.md`,
   link it from `wiki/INDEX.md`.
3. **Review checkpoint #2** — if the item is flagged `review`: re-read the new spec
   page, present it to the user, and pause for approval. Resume on approval. If not
   flagged, continue.
4. **test-writer** — delegate. Tell it to read the spec page + `wiki/architecture.md`,
   write **failing tests only**, and confirm they fail (red).
5. **implementer** — delegate. Tell it to read the spec page + the tests, write the
   minimum code to make them pass, and confirm green. Retry budget: 3 attempts inside
   the implementer. If still red, route the failure context back once more; if it still
   fails, **escalate** (see below).
6. **reviewer** — delegate. Tell it to verify every acceptance criterion against the
   wiki, confirm the **full** test suite is green, and check for scope creep. A
   rejection loops back to `implementer` once with the review notes; a second rejection
   **escalates**.
7. **Done** — when the reviewer passes AND the full suite is green: commit (see below),
   mark the item `done` in `wiki/backlog.md`, append the outcome + commit hash to
   `wiki/progress.md`, and move to the next item.

Run **until blocked** — keep pulling items until the backlog has no `todo` items, you
hit a review checkpoint, or you escalate.

## Delegation rules

- **Artifact handoff** — subagents do not share your conversation. Every `Task` prompt
  must name the **exact files** the agent should read and write, and tell it to read
  `wiki/INDEX.md` first.
- **Specialists** — beyond the core pipeline you may spawn ad-hoc `general-purpose`
  agents with a role-specific prompt (researcher, security-auditor, designer, …) for
  one-off needs. A researcher's notes feed `spec-writer`; a security-auditor runs
  alongside `reviewer`; a designer's output feeds a `wiki/specs/` page. If a role
  recurs, persist it as `.claude/agents/<role>.md` — it registers on the next session.

## Commits

The **bootstrap baseline** is committed once, on the first run (see above). After that,
**one commit per completed item**, after green + review: stage the item's files and
commit with a message referencing the backlog item (e.g. `B3: add user login`).
**Never push** unless the user asks.

## Escalation

When you cannot resolve a failure within the retry budget, **stop**: write the reason,
what was tried, and the suggested next step to `wiki/progress.md`, and state the same to
the user in chat. Do not thrash.

## Logging

Use the `Edit` tool — never Bash string-manipulation — to update `wiki/backlog.md`
(item statuses), `wiki/progress.md` (run journal), and `wiki/decisions.md`
(orchestration decisions, ADR-style). Keep `progress.md` current as items move through
the pipeline; it is your durable record of which stage each item is at.
</content>
</invoke>
