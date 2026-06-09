---
"zod4-mock": patch
---

Array-field overrides on an object schema previously replaced elements wholesale via two compounding mechanisms (step-0 eager-array consumption and a post-record whole-record `deepMerge`), dropping generated sibling fields. They now flow through a single per-field override-application site that per-index deep-merges each override slot onto the generated element, consistent with the array arms (D14); `deepMerge` is unchanged and the whole-record pass is removed.
