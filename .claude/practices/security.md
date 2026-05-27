# Practice: security

Load for any item touching authentication, authorization, secrets, input handling, file/
network access, or permissions.

## Knowledge

- **Validate and escape at every boundary.** Treat all external input (users, APIs, files,
  env) as hostile until validated. Escape on output for the destination (HTML, SQL, shell, JSON).
- **Parameterize queries** — never string-concatenate untrusted data into SQL/commands.
- **Authorize every access, not just authenticate.** Check the caller is allowed to act on
  *this* resource, on every request — not only that they are logged in.
- **Never commit or log secrets.** Keys/tokens/passwords come from config/secret stores; keep
  them out of code, logs, fixtures, and error messages.
- **Least privilege + safe defaults.** Default-deny; grant the minimum; fail closed.
- **Don't roll your own crypto/auth** — use the vetted library the project already depends on.

## Rationalizations → rebuttals

| Excuse | Reality |
|---|---|
| "This input is internal/trusted." | Validate at every boundary; "internal" callers get compromised too. |
| "We'll add authz later." | Missing authz is the bug. Add it with the feature, test the forbidden path. |
| "It's just a demo / MVP." | Secure defaults cost little now and are expensive to retrofit. |

## Red flags

- A query or command built by string concatenation with untrusted data.
- A secret in the diff, a log line, a test fixture, or an error message.
- An endpoint that checks *who you are* but not *whether you may do this*.
- Reflecting user input back unescaped.

## Verification (evidence the practice was applied)

- Each external input has explicit validation/escaping at its boundary.
- The **forbidden** path is tested (unauthorized access is denied), not just the happy path.
- No secret appears anywhere in the diff.
- Security-sensitive requirements have scenarios that assert the safe behaviour.
