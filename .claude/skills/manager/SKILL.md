---
name: manager
description: Orchestrates Vibin's wiki-driven, spec-driven, test-first build pipeline. The top-level session runs this skill to order the backlog and drive the spec-writer -> test-writer -> implementer -> reviewer pipeline (or the bug / research / chore tracks), one item at a time. Use after /bootstrap, or to resume building the backlog.
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
(item cards, `progress.md`, `decisions.md`, and the **Rules** section of
`architecture.md` — which you own; see "Done") and git operations (`git mv` for lane
moves, `git commit` for completed items).

## STEP 0 — read the wiki (mandatory, enforced)

Before anything else, **Read `wiki/INDEX.md`** and the wiki pages it links that are
relevant to the work: `wiki/vision.md`, `wiki/requirements.md`, `wiki/architecture.md`,
`wiki/backlog/README.md`, `wiki/decisions.md`, `wiki/progress.md`, and the item cards
in `wiki/backlog/ready/` + `wiki/backlog/doing/`. The wiki is the single source of truth
and the spec. A `PreToolUse` hook blocks writes, Bash, and agent spawns until you do.
If the wiki changes mid-run, re-read the affected pages before continuing.

## Resuming

This skill is **resumable**. Its durable state is the directory `wiki/backlog/**`
(items, lanes, frontmatter) and `wiki/progress.md` (run journal). On every invocation,
reconstruct where things stand from those — never assume a fresh start. To see state
quickly, run `/status` or `ls wiki/backlog/{inbox,ready,doing,done}/`.

## The initial work plan (review checkpoint #1)

On the first run for a project (`doing/` is empty and `progress.md` has only the
bootstrap note, if anything):

1. **Commit the bootstrap baseline.** `/bootstrap` scaffolds the stack and populates
   the wiki but does not commit. If the working tree has uncommitted changes, stage and
   commit them as the project baseline (e.g. `chore: scaffold <project> (bootstrap)`)
   so feature commits start from a clean tree. Never push.
2. **Build an ordered work plan** from the items currently in `wiki/backlog/inbox/` +
   `wiki/backlog/ready/`. Sort by `priority:` (high first), then by `created:` (oldest
   first). One line per item using this format:

   ```
   B<id> <title>  —  track: <type>  —  approach: <one line>  —  specialists: <none|list>  [review]
   ```

   Example:

   ```
   B1 user login         —  track: feature   —  approach: magic-link, no password store  —  specialists: none
   B2 audit auth surface —  track: research  —  approach: enumerate endpoints, threat-model OAuth  —  specialists: security-auditor
   B3 fix login on Safari—  track: bug       —  approach: reproduce on iOS 17, isolate cookie issue  —  specialists: none  [review]
   ```

3. **Auto-flag** items as `review` (add `flags: [review]` to their frontmatter, via
   `Edit`) if they are risky, ambiguous, or architecturally significant. Items the
   user already flagged stay flagged.
4. **Present the plan to the user and pause for approval.** Do not start building
   until the user approves.

## Triage

If the user reports a bug, new requirement, or change of direction **while you're
working an item**, do not start fixing it inline. Call `/intake "<title>"` to file it
as a new item in `wiki/backlog/inbox/`, tell the user the id + lane it landed in, and
continue the current item. The exception is a trivial typo/comment fix adjacent to the
current item — fold that into the current item's commit. See CLAUDE.md → Triage.

An **answer to an open question** on the current item (including a decision a specialist
needs) is **not** new work: fold it into that item's spec (re-dispatch `spec-writer`), never
`/intake`. Only genuinely new scope or a change of direction becomes a backlog item.

## Tracks (dispatch on the item's `type:`)

| `type:` | Stages |
|---|---|
| `feature` | `spec-writer` → `test-writer` → `implementer` → `reviewer` |
| `bug` | `spec-writer` → `test-writer` (regression test for the reported failure) → `implementer` → `reviewer` (confirms the regression test is present) |
| `research` | `general-purpose` researcher (writes `wiki/research/<topic>.md`) → `reviewer` (confirms findings answer the question, no implementation) |
| `chore` | `implementer` → `reviewer` (no spec page, no tests-first) — dep bumps, doc reorgs, infra |

A `feature`/`bug` card may carry **`mode: lite`** to run the lite track (`implementer` →
`reviewer (lite)`, no spec, no tests-first) — but only when it passes the **lite gate** below.

For unknown types: ask the user before proceeding. To add a project-specific type,
record the decision in `wiki/decisions.md` and extend this table by editing this skill.

## Lite track (`mode: lite`)

The lite track cuts ceremony for **small, behavior-neutral product changes** (a copy fix, a
CSS tweak, trivial config). It is **gated**, and it is **never** a tests-first bypass for real
behavior.

**Lite gate — an item may run lite only if ALL hold:**
- touches **≤ ~a handful of files** and adds **no new dependency**;
- makes **no schema, API, or public-contract change**;
- introduces **no new observable behavior that warrants a test** (cosmetic, copy, formatting,
  comment, trivial config, doc-in-code);
- is **not security-sensitive** (auth, secrets, input handling, permissions).

If **any** condition fails → run **full**. When in doubt → **full**. A `bug` that fixes real
behavior is **always full** (it needs a regression test). `chore` is non-product work (deps,
infra, doc reorgs); `lite` is a *trivial product* change — keep them distinct.

**Dispatch.** For a `mode: lite` item that passes the gate, dispatch **`implementer (lite)` →
`reviewer (lite)`** only. Skip `spec-writer` and `test-writer` — and therefore steps 3 (open
questions) and 4 (spec-validation gate), which are spec-only. The contract is the card's
`## Description` plus a one-line acceptance note (no spec page).

**Gate re-check (before honoring lite).** Re-apply the gate yourself before dispatching. If any
condition fails, **run the item full** and note the downgrade + reason in `wiki/progress.md`.

**Auto-promote (mid-flight).** If the `implementer (lite)` reports the change is bigger than
the gate allows (assertable behavior, a schema/API/contract change, more than a handful of
files, or anything security-sensitive), **reroute through the full track** (`spec-writer` →
`test-writer` → `implementer` → `reviewer`), set the card to `mode: full`, and note the
promotion in `wiki/progress.md`. Likewise if `reviewer (lite)` FAILs with "needs full track".

## The per-item pipeline

For each item, top of the ordered work plan first:

1. **Move the item card to `doing/`** with `git mv wiki/backlog/ready/<id>-<slug>.md
   wiki/backlog/doing/`. Append a start line to `wiki/progress.md` (via `Edit`):
   `## <YYYY-MM-DD HH:MM> — <id>: <title>` followed by `- manager: start, track: <type>`.
2. **Dispatch by track** (above). Every `Task` prompt MUST name the **exact files** the
   agent should read and write — agents do not share your conversation. Read templates
   below.
3. **Handle open questions (feature/bug — do not stall the run).** After `spec-writer`
   produces the spec, read its `## Open questions`:
   - **Any blocking question** → copy the open questions into the item card's
     `## Open questions`, set `flags: [needs-answers]`, `git mv` the card **back to
     `wiki/backlog/inbox/`**, note it in `progress.md`, and tell the user which item is
     waiting and what the questions are. Then **continue with the next ready item** — do
     **not** block the run on a synchronous prompt. (Resume: see "Items awaiting answers".)
   - **Only non-blocking questions** → they stay recorded in the spec; surface them to the
     user in your report, and the item proceeds.

   A **specialist's needed decision** (e.g. a copywriter needing final copy) is an open
   question on *this* item — route it through here, never `/intake`.
4. **Spec-validation gate (feature/bug, before `test-writer`)** — once no blocking question
   remains, re-read `wiki/specs/<id>-<slug>.md` and confirm:
   - every requirement has a `B<n>-R<k>` ID, **exactly one** RFC-2119 keyword
     (`MUST`/`MUST NOT`/`SHOULD`/`MAY`), and **≥1** `GIVEN/WHEN/THEN` scenario;
   - every scenario has an **observable** `THEN`;
   - no blocking open question is left unresolved (blocking ones were bounced in step 3).

   If the spec fails any check, route it **back to `spec-writer`** with the specific gap
   (it does not go forward to `test-writer`). This is a manager step — no separate tooling.
5. **Review checkpoint #2** — if the item is flagged `review`: after the spec passes the
   gate, re-read the artifact (the spec page, or the researcher's report), present it to
   the user, and pause for approval. Resume on approval. Unflagged items continue
   without pause.
6. **Retry budget**:
   - `implementer` runs its own 3-attempt loop. If still red, route the failure context
     back for one more attempt (4th total). If still red, **escalate**.
   - `reviewer` rejection loops back to `implementer` once with the review notes
     attached. A second rejection **escalates**.
7. **Done** — when the reviewer passes AND the full test suite is green:
   - **Promote any standing constraint to a rule (mandatory).** If the reviewer flagged
     that this item established or changed a standing constraint, add or update the
     one-line RFC-2119 rule in `architecture.md`'s **Rules** section (via `Edit`), citing
     the `D<n>` the subagent logged in `decisions.md`. This is the step that makes the
     convention reach the next session — do not skip it. Keep the rule to one line; the
     rationale stays in `decisions.md`.
   - `git mv wiki/backlog/doing/<id>-<slug>.md wiki/backlog/done/`.
   - Stage all the item's files (test files, implementation files, the moved card,
     any wiki updates) and commit with `B<id>: <title>` as the subject.
   - Append the outcome + commit hash to `wiki/progress.md`.
   - Pull the next item from `ready/` and loop.

Run **until blocked** — keep pulling items until `ready/` is empty, you hit a review
checkpoint, or you escalate.

## Items awaiting answers (`needs-answers`)

An item bounced in step 3 sits in `inbox/` flagged `needs-answers` with its questions in its
`## Open questions`. On every planning pass, handle these **before** triaging genuinely new
inbox items:

- If the user has written answers on the card (and cleared the flag, or moved it to `ready/`):
  `git mv` it to `doing/` and re-dispatch **`spec-writer (incorporate answers)`** (template
  below) to fold the answers into the existing draft spec and clear the resolved questions.
  Then continue the normal pipeline from the spec-validation gate.
- If it is still unanswered: **list it as awaiting your answer** (id + the questions) and skip
  it. A `needs-answers` item never silently advances and is never re-triaged as new work.

The draft spec the spec-writer already wrote persists (the card's `spec:` still points at it);
bouncing only parks the **card**, it does not discard work.

## Practices

`.claude/practices/<name>.md` hold reusable, stack-agnostic **practice knowledge** (security,
accessibility, debugging, performance, copywriting; a project may add more at bootstrap). They
are loaded **on demand, manager-driven**: when dispatching an item, decide which practice(s)
apply — from its `type:`, spec, and risk — and **name the file(s) in the delegation prompt**
so the subagent reads only what's relevant. Load the **same** practice into the `reviewer` so
it checks against it. Never load the whole library. Rough mapping (judge per item):

| Signal on the item | Practice |
|---|---|
| auth, secrets, input handling, permissions | `security` |
| any user-facing UI | `accessibility` |
| a `bug` item / diagnosing a failure | `debugging` |
| hot paths, large data, latency budgets | `performance` |
| user-facing copy, labels, error messages | `copywriting` |
| UI scenarios in a browser-enabled project | `browser-testing` |

See `.claude/practices/README.md`. An item may need none, one, or a few.

**UI verification.** If `wiki/architecture.md` says browser testing is enabled and the spec
has any `Scenario (UI):`, name `.claude/practices/browser-testing.md` (and `accessibility`) in
the `test-writer` and `reviewer` prompts: the `test-writer` writes a Playwright test for each
UI scenario, and the `reviewer` drives the running app via the Chrome DevTools MCP and attaches
a screenshot. This rides the normal tests-first + reviewer steps — no separate stage. A browser
failure loops back to the `implementer` like any review finding.

## Delegation prompt templates

The exact files matter. Templates for each subagent. Where a practice applies, add a line:
`Practices: read and apply .claude/practices/<name>.md` (omit when none applies).

**spec-writer**:
> Read `wiki/INDEX.md`, then `wiki/backlog/doing/<id>-<slug>.md` (the item card),
> then `wiki/vision.md`, `wiki/requirements.md`, `wiki/architecture.md`, and any
> existing `wiki/specs/` pages it cross-references. Write
> `wiki/specs/<id>-<slug>.md` following `wiki/specs/README.md`: a `## Requirements`
> section where each requirement has a `B<n>-R<k>` ID, exactly one RFC-2119 keyword, and
> ≥1 `GIVEN/WHEN/THEN` scenario with an observable `THEN`. Classify every open question
> blocking/non-blocking. Every requirement must comply with `architecture.md`'s binding
> **Rules**; if an earlier spec for this item conflicts with a rule that landed since,
> update it to comply. Add a row for it to the Pages table in `wiki/INDEX.md`. Update the
> item card's `spec:` frontmatter field to point at the new spec page. Report back: spec
> path, one-line summary, and **each open question with its blocking/non-blocking
> classification**.

**spec-writer (incorporate answers)** — for a resumed `needs-answers` item:
> Read `wiki/INDEX.md`, the item card at `wiki/backlog/doing/<id>-<slug>.md` (the user's
> answers are in its `## Open questions`), and the draft spec at `wiki/specs/<id>-<slug>.md`.
> For each answered question, fold the answer into the relevant requirement or Context and
> **remove** that open question. For anything the user explicitly deferred, leave it under
> `## Open questions` annotated `Deferred by user — <reason>`. Do not invent beyond the
> answers. Report back: what changed, and whether any blocking question remains.

**test-writer**:
> Read `wiki/INDEX.md`, `wiki/architecture.md` (for the package manager and test
> command), `wiki/specs/<id>-<slug>.md`, and the item card at
> `wiki/backlog/doing/<id>-<slug>.md`. Use the package manager declared in
> architecture.md — do not substitute. Write failing tests at <test path the
> architecture page describes> — **one test per scenario**, named by requirement ID
> (e.g. `B<n>-R<k> / <scenario>`). Run the test command (`<command>`) and confirm the
> new tests fail for the right reason. Report back: the test file paths, the exact
> test command, and the failure summary. If this is a `bug` item, the regression
> test for the reported failure is required.

**implementer**:
> Read `wiki/INDEX.md`, `wiki/specs/<id>-<slug>.md`, the test files at
> <paths from test-writer>, `wiki/architecture.md` (for the package manager and
> test command), and the item card at `wiki/backlog/doing/<id>-<slug>.md`. Use the
> package manager declared in architecture.md — do not substitute. Implement the
> requirements <list the B<n>-R<k> IDs>. Write the minimum code to make the failing
> tests pass; do not weaken tests. Run the full suite with `<command>` until everything
> is green. Retry budget: 3 attempts. If still red, stop and report what you tried.
> Report back: files written, full-suite run summary, any flagged tests or spec gaps.

**reviewer**:
> Read `wiki/INDEX.md`, `wiki/specs/<id>-<slug>.md`, `wiki/requirements.md`,
> `wiki/architecture.md`, the test files at <paths>, the implementation files at
> <paths>, and the item card. Run the full test command `<command>` and confirm
> green. Verify every requirement (by `B<n>-R<k>` ID) is met and each scenario is
> covered by a passing test. For a `bug` item, confirm the regression test is present.
> Verify no scope creep. Report PASS or FAIL with specific findings (file path +
> requirement ID + expected/actual + suggested fix on FAIL).

**implementer (lite)** — for a `mode: lite` item (no spec, no tests):
> Read `wiki/INDEX.md`, the item card at `wiki/backlog/doing/<id>-<slug>.md`, and
> `wiki/architecture.md` (package manager + test command). There is **no** spec page or
> failing test — the contract is the card's `## Description` + this acceptance note: <one
> line>. Make that change and **nothing more**; it must be **behavior-neutral** (the lite
> gate). Run the full suite with `<command>` and confirm it stays green (no regressions). If
> the change turns out to need new behavior, a schema/API change, more than a handful of
> files, or anything security-sensitive, **stop and report that it needs the full track** —
> do not implement it lite. Report back: files changed, full-suite summary, or a
> needs-full-track flag.

**reviewer (lite)** — for a `mode: lite` item:
> Read `wiki/INDEX.md`, `wiki/architecture.md`, the item card, and the changed files. There
> is **no** spec page — do not look for requirement IDs. Verify: the change matches the card's
> `## Description` + acceptance note; the **full** suite is green (run `<command>`); no scope
> creep; the change is genuinely behavior-neutral and complies with `architecture.md`'s Rules.
> If the change actually introduced assertable behavior or exceeded the lite gate, **FAIL**
> with "needs the full track" so the manager promotes it. Otherwise PASS.

For `research` items, spawn a `general-purpose` agent with a prompt naming the
question, the relevant wiki pages, and `wiki/research/<topic>.md` as the output path.

## Commits

The **bootstrap baseline** is committed once, on the first run (see above). After
that, **one commit per completed item**, after green + review: stage the item's files
(the moved card in `wiki/backlog/done/`, test files, implementation files, any wiki
updates) and commit with `B<id>: <title>` as the subject. **Never push** unless the
user asks.

## Escalation

When you cannot resolve a failure within the retry budget, **stop**: write the reason,
what was tried, and the suggested next step to `wiki/progress.md`, and state the same to
the user in chat. Do not thrash. The user can resume with `/manager` after fixing the
underlying issue, or skip the item by adding `flags: [blocked]` to its card with a
one-line reason in `## Notes`.

## Logging

Use `Edit` (or `Write` for new files) — never Bash string-manipulation — to update
item cards (frontmatter, Notes), `wiki/progress.md` (run journal),
`wiki/decisions.md` (orchestration decisions, ADR-style), and `architecture.md`'s
**Rules** section (promote a reviewer-flagged standing constraint to a one-line rule when
an item is done). Use `Bash git mv` for lane moves; the card filename does not change. Keep `progress.md` current as items move
through the pipeline; it is your durable record of which stage each item is at.
