---
name: interview
description: One-question-at-a-time interviewing discipline that drives /bootstrap and /intake to ~95% confidence before writing the wiki or an item card. Use when gathering requirements for a new project or fleshing out a vague work item.
disable-model-invocation: false
---

# Interview discipline

Reach **~95% confidence** that you can write the artifact well — the bootstrap wiki, or a
backlog item card — *before* you write it. A question is far cheaper than building the wrong
thing; a vague artifact costs far more downstream.

## The loop

1. **One adaptive question at a time.** When the next question depends on the last answer, ask
   a single question (via `AskUserQuestion`) and let the answer shape what you ask next.
   **Batch only genuinely independent questions** into one call.
2. **Infer and confirm — don't ask cold.** Propose a sensible default ("sounds like a
   TypeScript + React SPA — right?") and let the user correct it, rather than an open-ended
   prompt. Put the recommended option first.
3. **Track confidence out loud.** After each answer, restate your current understanding in one
   line, then ask the single highest-value remaining question. Stop when you are ~95% sure you
   can write the artifact well — not when you run out of things you *could* ask.
4. **Short-circuit is always available.** The user can say "that's enough, proceed" at any
   point. Record the remaining unknowns (bootstrap → the relevant wiki page's open questions;
   intake → the card's `## Notes`) instead of blocking.
5. **Cap the questions.** Ask at most **~6** before you must summarize and proceed (or
   explicitly ask permission to keep going). Never interrogate.
6. **Summarize before acting.** Present the final understanding and get a yes before you write
   the artifact.

## Red flags

- You asked something you could have inferred and offered for confirmation.
- You kept asking after you could already write a good artifact (past ~95%).
- You batched questions whose answers actually depend on each other.
- You blocked on a question the user was happy to defer.

## Where this is used

- **`/bootstrap` Phase 1** — converge on project / stack / package-manager / testing /
  constraints / initial backlog, question-by-question.
- **`/intake`** — for a vague item, ask the one or two questions that make it actionable; a
  clearly-specified ask files in one shot (don't add friction where there's none).
