---
name: tdd-cycle
description: Reference for the red-green-refactor test-first discipline used by the test-writer and implementer agents. Use when you need the canonical explanation of how Vibin's tests-first workflow works, or to settle a question about test ordering, "minimum" code, or trivially-passing tests.
disable-model-invocation: false
---

# The TDD cycle in Vibin

Vibin is **test-first, always** (for `feature` and `bug` items). Tests are written
from the spec **before** the implementation exists. This page is the canonical
reference — the discipline itself is baked into the `test-writer` and `implementer`
agent prompts, so it runs whether or not anyone invokes this skill.

## The cycle

### RED — `test-writer`

- Translate each requirement scenario in `wiki/specs/<id>-<slug>.md` into a test —
  one test per scenario, named by requirement ID (e.g. `B<n>-R<k> / <scenario>`).
- The tests **must fail** when first run — the feature does not exist yet.
- Verify they fail for the **right reason** (feature missing, or, for a `bug` item,
  the reported failure reproduced), not because of a typo or a broken test harness.
- No implementation code is written in this step.

#### What counts as trivially-passing

A trivially-passing test is one that would pass *before* any implementation exists —
e.g. `assert True`, asserting against a constant the test sets itself, or checking
"function exists" without exercising it. The `test-writer` does not write these. See
`.claude/agents/test-writer.md` → "What counts as a trivially-passing test".

### GREEN — `implementer`

- Write the **minimum** code that makes the failing tests pass.
- No extra features, no speculative abstractions, no scope beyond the spec and tests.
- Re-run until the targeted tests pass **and** the full suite is green.
- Tests are not weakened, deleted, or trivially rewritten to get green. A test that
  looks genuinely wrong is **flagged**, not silently changed.

#### What counts as "minimum"

Minimum = the smallest code that turns the tests green. If an inline check would
pass, do not extract a helper; if a literal value would pass, do not generalise; if
one file is enough, do not split it. See `.claude/agents/implementer.md` → "What
counts as 'minimum'".

### REFACTOR — `implementer`, optional, within the same item

- With the suite green, improve structure/readability **without changing behaviour**.
- The suite must stay green throughout. If it goes red, the refactor is the problem.
- Keep it minimal — refactoring is not a license for scope creep. Larger cleanups
  belong in a separate `chore` item.

## Why tests first

- The requirement scenarios become **executable** — "done" is objective.
- The implementer gets an unambiguous target and a regression net.
- The reviewer can verify against a concrete contract, not an opinion.

## Ground rules

- One backlog item flows RED → GREEN → (REFACTOR) before the next item starts.
- The full test suite — not just the new tests — must be green for an item to be
  **done** (moved to `wiki/backlog/done/`).
- If the spec is too vague to write a testable test, that is a spec problem: report
  it back up the pipeline rather than guessing.
- **`chore` and `research` items skip this cycle** — `chore` runs implementer →
  reviewer without tests-first; `research` produces a `wiki/research/<topic>.md`
  artifact. See the Tracks table in `.claude/skills/manager/SKILL.md`.

## Anti-rationalization anatomy

The cycle only holds if agents resist the shortcuts that quietly defeat it ("too small to
test", "the test mirrors the code", "I'll refactor later", "green is enough, pass it"). Each
pipeline agent therefore carries three sections that name the temptation and the evidence
that counters it — read them before you start:

- **Rationalizations → rebuttals** — common excuses paired with the reality.
- **Red flags** — symptoms to catch in yourself mid-task.
- **Verification** — the concrete evidence required to claim done.

See `.claude/agents/test-writer.md`, `.claude/agents/implementer.md`,
`.claude/agents/reviewer.md`, and `.claude/agents/spec-writer.md`.
