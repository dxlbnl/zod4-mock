# Practice: debugging

Load for a `bug` item, or any time you are diagnosing a failure rather than building new
behaviour.

## Knowledge

- **Reproduce first.** Capture the failure in a runnable form — ideally a failing test — before
  attempting a fix. No repro means no proof you fixed anything.
- **Isolate.** Shrink to a minimal case; bisect (recent changes, inputs, components) to localize
  the cause. Change one thing at a time.
- **Root cause, not symptom.** Find *why* it fails. Patching the symptom (swallowing the error,
  special-casing the input) leaves the bug alive.
- **Read the actual error** and check your assumptions against reality (logs, state) instead of
  guessing.
- **Keep the regression test** so the bug cannot return.

## Rationalizations → rebuttals

| Excuse | Reality |
|---|---|
| "I can see the fix, skip the repro." | Without a reproducing test you can't prove the fix — or prevent regressions. |
| "It's probably this line." | "Probably" is a guess; confirm the cause before changing code. |
| "I'll just patch the symptom." | The root cause will resurface elsewhere; fix the cause. |

## Red flags

- Editing code to fix a bug with no failing test that reproduces it.
- Several changes at once, so you can't tell which one mattered.
- "Works on my machine" without isolating the environment difference.
- Catching/swallowing the error to make the symptom disappear.

## Verification (evidence the practice was applied)

- A regression test reproduces the original failure and now passes.
- The report names the **root cause**, and the fix addresses it (not just the symptom).
- The full suite is green — the fix introduced no new failure.
