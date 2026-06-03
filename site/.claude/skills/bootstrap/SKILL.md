---
name: bootstrap
description: Primary entry point for a freshly cloned Vibin seed repo. Interviews the user about the project, stack, constraints, and initial backlog, populates the wiki/ starter pages, scaffolds the chosen stack, and hands off to the manager skill. Use when starting a new project, or when the user says "bootstrap", "set up the project", or "let's begin".
disable-model-invocation: false
---

# Bootstrap a Vibin project

This skill turns a freshly cloned seed repo into a project the agent pipeline can build.
Work through the phases in order. **Read `wiki/INDEX.md` first** — the wiki-gate hook
blocks writing until you do.

## Phase 1 — Interview

If `wiki/` already has filled-in pages (not just the starter templates), do **not**
overwrite — offer to refine instead, and skip to Phase 3.

Use the `AskUserQuestion` tool to interview the user. Cover, at minimum:

- **Project** — what is being built, why, who for, what success looks like, non-goals.
- **Stack** — language, runtime/platform, key frameworks/libraries. Pin specifics.
- **Testing** — test runner, the exact full-suite test command, test file
  location/naming convention.
- **Constraints** — platforms, performance budgets, dependencies to use or avoid,
  deadlines, compliance.
- **Initial backlog** — the first concrete work items, roughly prioritized.
- **Specialists** — which specialist roles this project will likely need (researcher,
  frontend-dev, security-auditor, designer, data-modeler, …).

Ask in batches; don't interrogate. Infer sensible defaults and confirm them rather than
asking everything cold.

## Phase 2 — Populate the wiki

From the answers, fill in the starter pages (replace the template placeholders):

- `wiki/vision.md` — project, why, who, success, non-goals.
- `wiki/requirements.md` — functional requirements, constraints, assumptions, open
  questions.
- `wiki/architecture.md` — stack, **test setup** (runner + exact command + file
  convention), project structure, key decisions.
- `wiki/backlog.md` — the initial items, prioritized, with status `todo`. Add a
  `review` flag to any the user wants to approve before implementation.
- Add the first real entry to `wiki/decisions.md` recording the stack choice.

Keep `wiki/INDEX.md`'s Pages table accurate if you add pages.

**Then pause** and ask the user to review/refine the wiki. The wiki is open-ended — they
can add any pages they like. Do not proceed until they confirm.

## Phase 3 — Scaffold

- Create the project structure named in `wiki/architecture.md` (e.g. `src/`, `tests/`).
- Set up the **minimal** test runner configuration for the chosen stack — just enough
  that `test-writer` can write a failing test and run the suite. Nothing more.
- Add the project's test command to `.claude/settings.json` under `permissions.allow`
  (e.g. `"Bash(npm test:*)"`, `"Bash(pytest:*)"`) so the agents can run tests without a
  prompt each time.
- For each recurring specialist role identified in the interview, write a
  `.claude/agents/<role>.md` file modeled on the core agents (frontmatter + a STEP 0
  wiki-read instruction + role-specific guidance). Note: newly written agent files may
  not register until the next session.

## Phase 4 — Hand off to the manager

Do **not** commit the scaffold yourself — leave the wiki + scaffolding as uncommitted
changes. The manager commits them as the project baseline on its first run.

Hand off by invoking the **`manager` skill** in this same top-level session — do **not**
spawn it as a subagent. Orchestration must run at the top level because only the
top-level session can spawn the pipeline subagents; a manager subagent would dead-end
the moment it tried to delegate.

The `manager` skill reads `wiki/INDEX.md` + `wiki/backlog.md`, commits the bootstrap
baseline, and produces the initial ordered work plan for the user's approval. From there
the top-level session runs the manager role and drives the pipeline.
