---
name: migrate-vibin
description: Bring an existing Vibin project up to date with the latest seed by diffing the project's recorded seed commit against the latest Vibin on GitHub and applying the changes. Use when the user says "migrate", "migrate-vibin", "upgrade Vibin", "apply the latest seed changes", or after a new seed release. Reads the seed commit hash from .vibin-version, audits the project's actual state, applies the migrations added since, and reconciles seed-owned files while preserving local customizations.
disable-model-invocation: false
---

# Migrate a Vibin project to the latest seed

Vibin is cloned per project, so seed improvements (its `.claude/**` agents, skills, hooks,
`CLAUDE.md`, and wiki **template** pages) do not arrive automatically. This skill brings
a project up to date by **diffing the seed commit the project was last synced to against the
latest Vibin on GitHub**, then applying the changes — without clobbering local
customizations.

## What propagates to a project — and what never does

The seed repo contains two kinds of files. Classify every changed file before touching it:

- **Child machinery (propagates — adopt or reconcile):** everything under `.claude/**`,
  `CLAUDE.md`, and the seed-owned **wiki template / README** pages (e.g.
  `wiki/specs/README.md`, `wiki/backlog/README.md`). These are the pipeline itself, so a
  project needs the latest version.
- **Seed-meta (NEVER written into a project):** `migrations/**`, `CHANGELOG.md`, `docs/**`,
  and the repo-root `README.md`. These document Vibin's own evolution; a project needs only
  the *effects* of a migration, not the migration files or Vibin's changelog/proposals. The
  skill **reads** `migrations/NNNN-*.md` from GitHub to learn each migration's content-aware
  steps and **applies** those steps, but it **never creates** these files in the project.
  (`.vibin-version` is the one marker a project keeps — this skill updates it.)

## STEP 0 — read the wiki (mandatory, enforced)

**Read `wiki/INDEX.md` first.** A `PreToolUse` hook blocks writes and Bash until you do. The
migration touches the wiki, so you must be working from the current source of truth.

## How versioning works

- `.vibin-version` (repo root) holds the **git commit hash** of the Vibin seed this project
  is currently synced to. `/bootstrap` stamps it with the seed commit the project was cloned
  from; this skill updates it after a successful upgrade. **The Vibin seed repo itself ships
  no `.vibin-version`** — it is its own latest, so the marker is meaningless there and
  exists only in downstream clones.
- The Vibin seed lives on GitHub at **`dxlbnl/vibin`**, and all of the network + diffing is
  done by **one committed tool**, `.claude/skills/migrate-vibin/migrate-plan.py`. It runs off
  GitHub's HTTP API — not local git (projects are often cloned with `.git` wiped before
  `/bootstrap`, so there is no shared history to `git diff` against; the API only needs the
  two commit hashes). Running the whole flow through this single allow-listed script — rather
  than improvising `curl`/`python3 -c` calls — keeps it to one approval, deterministic, and
  CLAUDE.md-compliant (a committed project tool, not an ad-hoc invocation).
- **The diff itself tells you what to run.** Which migrations apply = the
  `migrations/NNNN-*.md` files that are *newly added* between BASE and LATEST. There is no
  version-number arithmetic — the script stages each new migration so you read it and follow
  its content-aware steps (e.g. 0001 says to triage `wiki/decisions.md` and promote the
  standing constraints into `architecture.md`'s Rules section).

## Procedure

### 1. Run the planner (one command)
```
python3 .claude/skills/migrate-vibin/migrate-plan.py
```
This is the only network/diffing step. It reads BASE from `.vibin-version`, fetches LATEST
(head of `dxlbnl/vibin` main), compares them, classifies every changed file, **applies the
safe child-machinery files itself** (those unchanged locally — adopting LATEST is provably
safe and git-reversible), and **stages** everything you still need under `.vibin-migrate/`.
It writes nothing else and does not commit. Read its printed plan; it has five buckets:

- **APPLIED** — child-machinery files (`.claude/**`, `CLAUDE.md`, the wiki template READMEs)
  that were unchanged locally and have already been overwritten with LATEST. Nothing to do.
- **RECONCILE BY HAND** — child-machinery files the project customized. The script staged
  `.vibin-migrate/base/<path>` and `.vibin-migrate/latest/<path>`; reconcile against the
  local file (a 3-way merge), preserving the local customization. Prioritize the load-bearing
  files — agents (`.claude/agents/**`), skills, hooks, `CLAUDE.md`; trivial doc drift is not
  worth fussing over.
- **NEW MIGRATIONS** — staged at `.vibin-migrate/migrations/<name>`. Read each and follow its
  content-aware steps (next).
- **PROJECT CONTENT** — `wiki/*.md` (incl. `wiki/INDEX.md`) the seed changed; **never**
  auto-applied. Adapt your project's own wiki via the migration steps, not the raw diff.
- **SEED-META** — listed only for transparency; never written into the project.

If the script prints `UP TO DATE`, stop. If it errors that `.vibin-version` is missing, ask
the user for the commit the project was cloned from and re-run with it as an argument:
`python3 .claude/skills/migrate-vibin/migrate-plan.py <BASE_HASH>`.

### 2. Apply each new migration's content-aware steps
For every file under `.vibin-migrate/migrations/`, read it and follow its
`## Apply — project content` steps against the project's **own** wiki (`Read`/`Edit`/`Write`
— no network). This is the judgment work the script deliberately leaves to you. **Never
rewrite the body of a past `wiki/decisions.md` entry** (append-only).

### 3. Reconcile the customized files
For each **RECONCILE** file, read `.vibin-migrate/base/<path>`, `.vibin-migrate/latest/<path>`,
and the local file, and hand-merge the BASE→LATEST change into the local copy without losing
the customization.

### 4. Verify (read-only — no Bash, no prompts)
Run each applied migration's `## Verify` checks using the **`Grep`/`Read`/`Glob` tools**, not
Bash. These tools are auto-allowed, so verification never triggers a permission prompt. Do
**not** shell out to `grep`/`python3 -m py_compile`/`rm` for this — in particular, the planner
already ran in step 1 (so it provably works; no re-compile needed) and direct script runs
create no `__pycache__` to clean.

### 5. Record and commit
- Write the **LATEST** hash (printed by the script) to `.vibin-version`.
- Remove the staging dir with the same tool (already allow-listed, no extra prompt):
  `python3 .claude/skills/migrate-vibin/migrate-plan.py --clean`.
- Stage the applied + reconciled files, the wiki edits, and `.vibin-version`; commit
  `chore: migrate Vibin seed to <short-hash>`. Do not push unless the user asks.

### 6. Report
State: BASE → LATEST hashes, files applied wholesale, files reconciled by hand (and how),
content-aware wiki steps applied, and anything that needs the user's attention.

## Rules
- **Never write seed-meta into the project.** `migrations/**`, `CHANGELOG.md`, `docs/**`,
  and the repo-root `README.md` are Vibin's own evolution log — a project gets the *effects*
  of a migration, never the files. Read migrations from GitHub for their steps; do not copy
  them, the changelog, the proposals, or Vibin's README into the project.
- **The planner classifies; it only auto-writes the safe set.** It overwrites a
  child-machinery file only when the local copy is identical to the seed at BASE (no
  customization to lose). Customized files are staged, never auto-applied — you reconcile
  them by hand.
- **Use the committed script, not improvised calls.** All network + diffing goes through
  `migrate-plan.py` (a committed project tool — the CLAUDE.md exception to "no ad-hoc
  `node`/`python`"). Do not improvise `curl`/`python3 -c`/`for`-loops; that is what caused
  per-call approval prompts. Apply the content-aware and reconcile edits with
  `Read`/`Edit`/`Write`.
- **Important files first.** Agents, skills, hooks, and `CLAUDE.md` are the ones that must be
  correct; don't block the whole migration over cosmetic doc drift.
- **Respect `decisions.md` append-only** — header/format-template text may be updated, past
  entry bodies may not.
- **This seed repo is its own latest**, so running `/migrate-vibin` here is a no-op (and the
  seed carries no `.vibin-version`). The skill is for downstream clones.
