---
name: intake
description: File a new work item into wiki/backlog/inbox/. Use whenever the user reports a bug, asks for a feature, or proposes a change of direction mid-run — instead of inline-patching. Any agent (including subagents) can invoke this. Triggered by /intake "<title>" or when an agent recognises new work that should be captured.
disable-model-invocation: false
---

# Intake — file a new backlog item

This skill captures new work as a per-item file in `wiki/backlog/inbox/` so it goes
through the normal triage → spec → tests → impl → review flow instead of being
inline-patched in whatever was happening at the time. See CLAUDE.md → Triage.

Safe for any agent to invoke: it only reads the wiki and writes one new file under
`wiki/backlog/inbox/`. It does not spawn other agents and does not touch other items.

## Procedure

### Step 1 — read the wiki (gate compliance)

Read `wiki/INDEX.md` and `wiki/backlog/README.md` (the item card schema). A
`PreToolUse` hook blocks writes until you have.

### Step 2 — ask the user (or take from the invocation)

Take the title from the `/intake "<title>"` argument if present. Then use
`AskUserQuestion` to fill in the rest, with these questions and defaults:

- **type** — `feature` (default) / `bug` / `research` / `chore`. If the user said
  "bug" or "broken" in the title, default to `bug`. If the title is a question,
  default to `research`.
- **priority** — `high` / `medium` (default) / `low`.
- **description** — one or two sentences in the user's voice: the "why" and rough
  "what". Free-text question. If the user types nothing, leave a placeholder for the
  spec-writer to flesh out.
- **review flag** — yes / no (default no). Sets `flags: [review]` so the manager
  pauses for approval before tests/impl. Default to yes for `bug` (regression risk)
  and for any item the user describes as architectural/risky.
- **mode** (feature only) — `full` (default) / `lite`. Suggest `lite` for an obviously
  trivial, **behavior-neutral** ask (copy/text, CSS, a trivial config tweak) that touches few
  files, changes no schema/API, and isn't security-sensitive; the user can set or veto it. A
  `bug` is never lite. This is only a hint — the **manager re-checks the lite gate** and
  silently runs full (or auto-promotes mid-flight) if it doesn't qualify, so a wrong guess is
  caught, not relied on. Record `mode: lite` in the card; omit the field for full.

A **clearly-specified** ask files in one shot — don't add friction where there's none. For a
**vague** item, follow the interview discipline in `.claude/skills/interview/SKILL.md`: ask the
one or two adaptive questions that make it actionable, then file. If invoked by another agent
mid-task, take whatever fields the agent provides and only ask the user for the rest.

### Step 3 — allocate the id

Scan `wiki/backlog/**/*.md` with `Glob`. Parse each filename for the `B<n>-` prefix.
The next id is `max + 1` (or `B1` if no items exist). Slug the title:
lowercase, spaces → hyphens, strip punctuation, cap at ~40 chars.

### Step 4 — write the item card

Write `wiki/backlog/inbox/B<n>-<slug>.md`:

```markdown
---
id: B<n>
title: <title>
type: <type>
priority: <priority>
flags: <[review] | []>
mode: lite              # OMIT this line for full (the default)
created: <today YYYY-MM-DD>
---

## Description
<the description from step 2, or "(to be elaborated by spec-writer)">

## Notes
```

Do not link this file from `wiki/INDEX.md` — the backlog directory is already linked
via `wiki/backlog/README.md`. Individual item files are not separately indexed.

### Step 5 — report back

Tell the caller (user or invoking agent):

> Filed **B<n>: \<title>** as `<type>` in `wiki/backlog/inbox/B<n>-<slug>.md`
> (priority: `<priority>`, flags: `[…]`).

If the manager is mid-pipeline on another item, that item continues. The new item
sits in `inbox/` until the manager triages it on its next planning pass.

## Rules

- One item per invocation. If the user describes two separate things, file them as
  two separate items (call this skill twice).
- **An answer is not new work.** Do not file an answer to an open question on the item
  the manager is actively working (including a decision a specialist asked for) — that
  resolves the current spec, not a new backlog item. Only genuinely new scope or a change
  of direction is filed here.
- Do not move items between lanes. The manager owns lane transitions.
- Do not modify other items.
- Do not write or run code; you only file a single markdown file.
