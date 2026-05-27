# Practices

Reusable, stack-agnostic **practice knowledge** the pipeline loads **on demand**. A practice
is *knowledge*, not a role: it tells an agent how to do a kind of work well (security review,
accessibility, debugging, …). Practices are plain reference docs — deliberately **not**
registered skills — so they never clutter the slash-command / model-invocable list.

## How they load (manager-driven)

The **manager** decides which practice(s) apply to an item — from its `type:`, its spec, and
its risk — and names the file(s) in the delegation prompt (e.g. "read
`.claude/practices/security.md` and apply it"). The subagent reads only the named practice(s);
the **reviewer** loads the same one(s) to check the work. Only relevant practices load — never
the whole library. See `.claude/skills/manager/SKILL.md` → "Practices".

Rough mapping (the manager judges per item — not a hard table):

| Signal on the item | Practice |
|---|---|
| auth, secrets, input handling, permissions | `security` |
| any user-facing UI | `accessibility` |
| a `bug` item / reproducing a failure | `debugging` |
| hot paths, large data, latency budgets | `performance` |
| user-facing copy, labels, error messages | `copywriting` |
| UI scenarios in a browser-enabled project | `browser-testing` |

## Anatomy

Every practice doc carries the same sections as the pipeline agents: **Knowledge**,
**Rationalizations → rebuttals**, **Red flags**, and **Verification** (the evidence that the
practice was actually applied).

## Extending (per project)

The seed ships a lean, stack-agnostic core. `/bootstrap` keeps the ones a project needs and
adds **project/stack-specific** practices (e.g. `api-design`, `data-modeling`, `i18n`, or a
domain practice like `marketing`) as new `.claude/practices/<name>.md` files following the
same anatomy. Keep each practice focused; knowledge only one item needs belongs in that item's
spec, not here.
