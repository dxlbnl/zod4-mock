---
name: tdd-cycle
description: Reference for the red-green-refactor test-first discipline used by the test-writer and implementer agents. Use when you need the canonical explanation of how Vibin's tests-first workflow works, or to settle a question about test ordering.
disable-model-invocation: false
---

# The TDD cycle in Vibin

Vibin is **test-first, always**. Tests are written from the spec **before** the
implementation exists. This page is the canonical reference — the discipline itself is
baked into the `test-writer` and `implementer` agent prompts, so it runs whether or not
anyone invokes this skill.

## The cycle

### RED — `test-writer`

- Translate each acceptance criterion in the `wiki/specs/<item>.md` page into one or
  more tests.
- The tests **must fail** when first run — the feature does not exist yet.
- Verify they fail for the **right reason** (feature missing), not because of a typo or
  a broken test harness.
- No implementation code is written in this step.

### GREEN — `implementer`

- Write the **minimum** code that makes the failing tests pass.
- No extra features, no speculative abstractions, no scope beyond the spec and tests.
- Re-run until the targeted tests pass **and** the full suite is green.
- Tests are not weakened, deleted, or trivially rewritten to get green. A test that
  looks genuinely wrong is **flagged**, not silently changed.

### REFACTOR — `implementer`, optional, within the same item

- With the suite green, improve structure/readability **without changing behaviour**.
- The suite must stay green throughout. If it goes red, the refactor is the problem.
- Keep it minimal — refactoring is not a license for scope creep.

## Why tests first

- The acceptance criteria become **executable** — "done" is objective.
- The implementer gets an unambiguous target and a regression net.
- The reviewer can verify against a concrete contract, not an opinion.

## Ground rules

- One backlog item flows RED → GREEN → (REFACTOR) before the next item starts.
- The full test suite — not just the new tests — must be green for an item to be
  **done**.
- If the spec is too vague to write a testable test, that is a spec problem: report it
  back up the pipeline rather than guessing.
