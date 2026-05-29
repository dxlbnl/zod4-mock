---
"zod4-mock": patch
---

Extract `unwrapOptionalChainForField` helper. Two duplicate optional/nullable/default unwrap state machines (in `generateObjectFields` and `generateZodObject`) collapsed to one. Internal refactor; PRNG consumption byte-identical, behaviour unchanged.
