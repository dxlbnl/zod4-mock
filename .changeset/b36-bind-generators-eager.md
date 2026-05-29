---
"zod4-mock": patch
---

Replace `bindGenerators`'s double-Proxy machinery with an eagerly-bound object built once per `makeFieldCtx`. Drops two pre-existing `Record<string, any>` types and the runtime Proxy overhead. B40's locale-forwarding contract is preserved verbatim, including the bucket-2 (`person.firstName`/`middleName`/`fullName`/`prefix`) no-args-only locale-forwarding semantics. Internal refactor; no behaviour change.
