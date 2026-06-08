---
"zod4-mock": major
"@zod4-mock/locale-en": minor
"@zod4-mock/locale-nl": minor
---

Remove `generateFromSchema`, `generateFromKey`, `fieldSeed`, and `data` from the `zod4-mock` public barrel (internal-only; `data` was a duplicate of `generators`).
Move `extend` to the locale packages: `import { extend } from "zod4-mock"` becomes `import { extend } from "@zod4-mock/locale-en"` (or `@zod4-mock/locale-nl`).
