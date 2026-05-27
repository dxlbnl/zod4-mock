---
name: status
description: One-screen summary of where the manager pipeline is — lane counts, the active item with its current stage, the last escalation if any, and the next three ready items. Read-only. Use any time you want to know what's happening without disturbing a running pipeline.
disable-model-invocation: false
---

# Status — what's the manager doing right now

Read-only summary of pipeline state. Safe to run at any time. Does not modify any
file, does not spawn agents, does not move items between lanes.

## Procedure

### Step 1 — read the wiki (gate compliance)

Read `wiki/INDEX.md`. A `PreToolUse` hook blocks Bash/Task until you have.

### Step 2 — gather state

- **Lane counts** — count files in each of
  `wiki/backlog/{inbox,ready,doing,done}/` (exclude `.gitkeep`).
- **Active item** — the (at most one) item in `wiki/backlog/doing/`. Read its
  frontmatter for `id`, `title`, `type`, `flags`. Read its `## Notes` for any
  recent agent updates.
- **Current stage** — read the tail of `wiki/progress.md`. The last `- <agent>: …`
  line under the active item tells you which stage is running (or just completed).
- **Last escalation** — search `wiki/progress.md` for the most recent
  `result: escalated` line. If none, omit.
- **Next ready items** — list the first three filenames in
  `wiki/backlog/ready/` sorted by priority then created (read each card's
  frontmatter; high priority first, ties broken by oldest `created:`).
- **Blocked items** — any item with `flags: [blocked]` (or that contains `blocked`
  in its flags list) anywhere under `wiki/backlog/`.

### Step 3 — render

Print one screen of text in this shape:

```
Vibin status — <project name from wiki/vision.md, if available>

Lanes:  inbox <n>   ready <n>   doing <n>   done <n>
Doing:  B<id> <title>  —  track: <type>  —  stage: <agent (red|green|reviewing|…)>
        flags: [<flags>]
        last note: <last line of the item's ## Notes, or "—" if empty>

Next ready (top 3):
  1. B<id> <title>  (track: <type>, priority: <p>)
  2. ...
  3. ...

Blocked: <count or "none">
  - B<id> <title> — <one-line reason from ## Notes>
Last escalation: <progress.md line, or "none">

To resume: /manager
To file new work: /intake "<title>"
```

If `wiki/backlog/doing/` is empty, the `Doing:` block reads
`Doing:  (nothing — run /manager to pull the next ready item)`.

## Rules

- Read-only. Do not edit any file, do not move any item, do not run tests.
- If the wiki has not been bootstrapped (`wiki/backlog/` missing), report
  `Not bootstrapped — run /bootstrap to set the project up.`
- Keep it to one screen. The point is a glance, not an audit. For full history see
  `wiki/progress.md`.
