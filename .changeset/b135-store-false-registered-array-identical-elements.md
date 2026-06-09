---
"zod4-mock": patch
---

Fix `store: false` arrays of a registered schema collapsing to identical elements: each element seeded from a self-cancelling `registry.count + pending` index that froze under suppressed writes. Thread an explicit per-element index so the i-th store-off element matches the store-on record at index i.
