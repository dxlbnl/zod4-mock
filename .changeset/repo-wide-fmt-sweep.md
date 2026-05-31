---
"zod4-mock": patch
---

Internal — repo-wide `pnpm fmt` (oxfmt) sweep. The format gate had drifted unnoticed across many sessions (none of the recent items ran `pnpm fmt:check`). 202 files reformatted; pure whitespace, no behavioural change. After this lands, `pnpm validate` exits 0 across all four stages (typecheck + test + lint + fmt:check).
