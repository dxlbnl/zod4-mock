# Specs

Detailed feature and bug specs live here — **one page per item**, created and refined by
the `spec-writer` agent from a backlog item card in `wiki/backlog/`. These are wiki
pages, not a separate source of truth: the wiki *is* the spec.

Each spec page is named after its backlog item (e.g. `B3-user-login.md`) and is linked
from its item card's `spec:` frontmatter field. It is also linked from `../INDEX.md`'s
Pages table.

## Spec ↔ item card pairing

Every spec page has exactly one backlog item card pointing at it:

```
wiki/backlog/<lane>/B3-user-login.md   # item card, has `spec: wiki/specs/B3-user-login.md`
wiki/specs/B3-user-login.md            # this page
```

Research items pair with `wiki/research/<topic>.md` instead. Chore items have no spec.

## Spec page format

```
# B<n>: <feature title>

## Context
<why this feature exists; link to the relevant wiki pages and the item card>

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B<n>-R1: <short name>
The system MUST <single normative statement>.

- Scenario: <name>
  GIVEN <starting state>
  WHEN <action>
  THEN <observable, testable outcome>

### B<n>-R2: <short name>
The system SHOULD <single normative statement>.

- Scenario: <name>
  GIVEN ...
  WHEN ...
  THEN ...

## Out of scope
<what this item deliberately does not cover>

## Open questions
<each question classified **blocking** or **non-blocking**; a blocking question means
the item MUST be flagged `review` in its card and MUST NOT advance to test-writer>
```

The requirements are the contract: `test-writer` turns each **scenario** into a failing
test named by requirement ID, `implementer` makes them pass, `reviewer` verifies each
requirement ID is met.

## Requirement rules

- **Stable ID** — `B<n>-R<k>` (item id + requirement number). Tests and the reviewer
  cite it; do not renumber a shipped requirement.
- **One RFC-2119 keyword** per requirement — exactly one of `MUST` / `MUST NOT` /
  `SHOULD` / `MAY`, reserved for genuine requirements. Do not MUST-ify ordinary prose;
  if everything is `MUST`, the keyword loses its weight.
- **≥1 scenario** per requirement — each a `GIVEN / WHEN / THEN` with an **observable**
  outcome (a state or output a test can assert, never "feels fast"). A `MUST` scenario
  is mandatory; a `SHOULD` scenario is tested unless the spec explicitly waives it.
- **UI scenarios** — when a scenario's `THEN` is a **rendered/observed browser outcome**,
  tag it `- Scenario (UI): <name>` and make the `THEN` observable in the page (a visible
  element / text / role / state, never "looks nice"). In a **browser-enabled** project (a
  frontend stack — see `wiki/architecture.md`), a UI scenario is verified in a real browser:
  a committed **Playwright** test plus a **Chrome DevTools MCP** smoke-check at review, with a
  screenshot as evidence. In a non-browser project, write it as the closest unit/DOM test.

## Open questions are answered or deferred

The `## Open questions` section is enforced, not advisory: no open question silently
proceeds. The `spec-writer` classifies every question **blocking** or **non-blocking**.

- A spec carrying any **blocking** question MUST NOT advance to `test-writer`. The manager
  copies the questions onto the item card, flags it `needs-answers`, and bounces it to
  `inbox/` — then keeps working other items (the run is not stalled). When the user writes
  answers on the card, the `spec-writer` folds them into the spec and the item resumes.
- **Non-blocking** questions are recorded and surfaced to the user; the item proceeds.
- A user's answer can also be **deferred** — recorded under `## Open questions` as
  `Deferred by user — <reason>` rather than blocking progress.
