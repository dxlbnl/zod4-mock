---
name: bootstrap
description: Primary entry point for a freshly cloned Vibin seed repo. Interviews the user about the project, stack, package manager, constraints, and initial backlog, populates the wiki/ starter pages, scaffolds the chosen stack, writes the stack-specific permission profile, and hands off to the manager skill. Use when starting a new project, or when the user says "bootstrap", "set up the project", or "let's begin".
disable-model-invocation: false
---

# Bootstrap a Vibin project

This skill turns a freshly cloned seed repo into a project the agent pipeline can
build. Work through the phases in order. **Read `wiki/INDEX.md` first** — the wiki-gate
hook blocks writing until you do.

## Phase 1 — Interview

If `wiki/` already has filled-in pages (not the starter templates), do **not**
overwrite — offer to refine instead, and skip to Phase 3.

Interview the user following the **interview discipline** in
`.claude/skills/interview/SKILL.md`: one adaptive question at a time (batch only genuinely
independent ones), infer-and-confirm rather than asking cold, track confidence to ~95%, and
let the user short-circuit at any point. Cover, at minimum:

- **Project** — what is being built, why, who for, what success looks like, non-goals.
- **Stack** — pick one: `TypeScript`, `Python`, `Rust`, `Go`, `Other`. Pin the
  specific version (e.g. TS 5.x on Node 20 LTS) and key frameworks/libraries.
- **Package manager** (TypeScript projects only) — pick one:
  - `pnpm` *(default, recommended — deterministic installs, workspace ergonomics)*
  - `npm`
  - `yarn`

  If the user picks `npm` or `yarn`, surface a one-line warning ("pnpm is the
  default for deterministic installs and workspace ergonomics — proceed with
  npm/yarn anyway?") and confirm. For `Other` stacks, ask for the package manager,
  runtime, and test runner commands and treat them as a custom profile.
- **Testing** — test runner, the exact full-suite test command, test file
  location/naming convention.
- **Constraints** — platforms, performance budgets, dependencies to use or avoid,
  deadlines, compliance.
- **Initial backlog** — the first concrete work items, roughly prioritized, with a
  rough `type:` for each (`feature` / `bug` / `research` / `chore`).
- **Specialists** — which specialist roles this project will likely need (researcher,
  frontend-dev, security-auditor, designer, data-modeler, …).

## Phase 2 — Populate the wiki

From the answers, fill in the starter pages (replace the example text under each
heading; keep the headings themselves):

- `wiki/vision.md` — project, why, who, success, non-goals.
- `wiki/requirements.md` — functional requirements, constraints, assumptions, open
  questions.
- `wiki/architecture.md` — stack, **package manager** (use the binding format below),
  test setup (runner + exact command + file convention), project structure, and the
  **Rules** section. Seed the Rules with the standing constraints implied by your first
  decisions — at minimum the package-manager rule (→ D2) and any framework/library the
  project commits to (→ D1). One RFC-2119 line each, citing the decision. Keep it short.
- `wiki/backlog/inbox/` — **one file per initial backlog item**, not rows in a flat
  file. Filename `B<n>-<slug>.md`. Frontmatter follows `wiki/backlog/README.md`:

  ```markdown
  ---
  id: B1
  title: User login
  type: feature
  priority: high
  flags: []
  created: <YYYY-MM-DD>
  ---

  ## Description
  <one paragraph in the user's voice — the "why" and rough "what">

  ## Notes
  ```

  Use `flags: [review]` for any item the user wants to approve before implementation.
- `wiki/decisions.md` — add the first real entries: D1 the stack choice, D2 the
  package-manager choice (especially if the user overrode the pnpm default). Fill each
  entry's **Rule added/changed** field with the matching one-line rule you put in
  `architecture.md`'s Rules section, so every decision and its rule are linked from day
  one.

The architecture page's **Package manager** section is binding. Write it in this
exact format so agents can mechanically parse it:

```
## Package manager (binding)

- **Package manager**: pnpm (use only this — not npm, not yarn)
```

Keep `wiki/INDEX.md`'s Pages table accurate if you add pages beyond the defaults.

**Then pause** and ask the user to review/refine the wiki. The wiki is open-ended —
they can add any pages they like. Do not proceed until they confirm.

## Phase 3 — Scaffold

- **Strip Vibin seed-meta.** A fresh clone carries files that document Vibin's own
  evolution — they must not live in a project: `git rm -r --quiet migrations/ docs/`,
  and `git rm --quiet CHANGELOG.md README.md` (Vibin's README describes the seed, not this
  project; the project's own README comes from the stack scaffold below or a later item).
  Keep `.vibin-version`, `CLAUDE.md`, `.claude/**`, and `wiki/`. This is
  the same boundary `/migrate-vibin` enforces: a project gets the pipeline machinery and
  the *effects* of migrations, never Vibin's changelog, proposals, or migration files.
- Create the project structure named in `wiki/architecture.md` (e.g. `src/`,
  `tests/`).
- Set up the **minimal** test runner configuration for the chosen stack — just
  enough that `test-writer` can write a failing test and run the suite. Nothing more.
- For each recurring specialist role identified in the interview, write a
  `.claude/agents/<role>.md` file modeled on the core agents (frontmatter + STEP 0
  wiki-read instruction + role-specific guidance). Note: newly written agent files
  may not register until the next session.
- **Tune the practice library** (`.claude/practices/`). The seed ships a stack-agnostic core
  (security, accessibility, debugging, performance, copywriting, browser-testing). Keep the
  ones this project needs (e.g. drop `accessibility` for a headless service), and **add
  project/stack-specific practices** — `api-design` for an API, `data-modeling` for a DB-heavy
  app, `i18n`, `marketing`, etc. — as new `.claude/practices/<name>.md` files following the
  same anatomy (Knowledge / Rationalizations / Red flags / Verification). See
  `.claude/practices/README.md`.
- **Browser testing** (UI verification) — opt-in, **off by default**.
  - **Frontend project** (the stack ships a UI): keep `.claude/practices/browser-testing.md`;
    scaffold **Playwright** (add the dep + a minimal committed `playwright.config.*`) and
    append the matching permission entry to `.claude/settings.json` (e.g.
    `Bash(npx playwright:*)` / `Bash(pnpm exec playwright:*)`); record in
    `wiki/architecture.md` the **browser test command**, the app **run command**, and
    **"browser testing: enabled"**; log a decision + a one-line Rule ("UI scenarios are
    verified in a browser — Playwright in CI + Chrome DevTools MCP at review"). For the
    **Chrome DevTools MCP** (environment config), **do not self-configure** — describe the
    exact MCP-server setup and ask the user to apply it (see the env-config note below).
    Optionally write a `browser-tester` specialist for heavy-UI projects; otherwise the
    `reviewer` does the browser check.
  - **Non-UI project**: `git rm .claude/practices/browser-testing.md` and add nothing else —
    the capability stays dormant.

For configuration that touches the user's environment, CI, or external services
(secrets, repository settings, deploy targets), **do not run scripts or interpret
node/python to do the setup yourself**. Describe the exact file content / command,
and ask the user to apply it. See CLAUDE.md → No ad-hoc `node`/`python` invocations.

## Phase 4 — Stack permission profile + hand off

Append the matching **stack permission profile** to `.claude/settings.json`'s
`permissions.allow` array (do not replace the universal entries already there). Use
the table below verbatim:

| Stack key | Entries to append |
|---|---|
| `typescript-pnpm` | `Bash(pnpm:*)`, `Bash(pnpx:*)`, `Bash(node:*)`, `Bash(tsc:*)`, `Bash(tsx:*)` |
| `typescript-npm`  | `Bash(npm:*)`, `Bash(npx:*)`, `Bash(node:*)`, `Bash(tsc:*)`, `Bash(tsx:*)` |
| `typescript-yarn` | `Bash(yarn:*)`, `Bash(node:*)`, `Bash(tsc:*)`, `Bash(tsx:*)` |
| `python-uv`       | `Bash(uv:*)`, `Bash(python:*)`, `Bash(python3:*)`, `Bash(pytest:*)`, `Bash(ruff:*)`, `Bash(mypy:*)` |
| `python-pip`      | `Bash(pip:*)`, `Bash(pip3:*)`, `Bash(python:*)`, `Bash(python3:*)`, `Bash(pytest:*)`, `Bash(ruff:*)` |
| `rust`            | `Bash(cargo:*)`, `Bash(rustc:*)` |
| `go`              | `Bash(go:*)`, `Bash(gofmt:*)` |
| `other`           | Ask the user for the package manager / runtime / test runner commands and write a custom list. |

> For `typescript-pnpm`, **npm and yarn are deliberately omitted**. If an agent later
> tries `npm install`, it hits a permission prompt and the user can deny. Combined
> with the `wiki/architecture.md` declaration and the agent prompts'
> use-only-the-declared-package-manager rule, this triple-locks pnpm without a
> separate hook.

**Stamp the seed version.** Create `.vibin-version` (root) containing the **current head
commit hash of `dxlbnl/vibin`** — query the GitHub API for it (e.g. `get_commit` /
`list_commits` on the default branch). A fresh clone *is* the latest seed, so its head hash
is what the project's `.claude/**` and templates match. Get it from the API rather than
`git rev-parse HEAD`, because projects are often cloned with `.git` wiped before bootstrap.
`/migrate-vibin` later diffs this hash against the latest Vibin (via the GitHub compare API)
to upgrade the project. (The seed repo itself ships no `.vibin-version`, so this is a new
file in the clone.)

Do **not** commit the scaffold or settings changes yourself — leave the wiki +
scaffolding + permissions update as uncommitted changes. The manager commits them as
the project baseline on its first run.

Hand off by invoking the **`manager` skill** in this same top-level session — do
**not** spawn it as a subagent. Orchestration must run at the top level because only
the top-level session can spawn the pipeline subagents; a manager subagent would
dead-end the moment it tried to delegate.

The `manager` skill reads the wiki, commits the bootstrap baseline, and produces the
initial ordered work plan for the user's approval. From there the top-level session
runs the manager role and drives the pipeline.
