---
"zod4-mock": patch
---

Forbid dual primary+derived registration of the same schema reference on a world. `WorldImpl.withSchema` now throws when the incoming registration's polarity (`opts?.from !== undefined` ⇒ derived; otherwise primary) conflicts with the polarity of an existing registration of the same schema reference. The throw fires before the new `SchemaReg` is appended, so the failed call leaves the registration list unchanged. Same-polarity re-registration (two primary, or two derived from any source) is unchanged; appearing as another schema's `relations:` target or `from:` source is not a registration and is unaffected. The latent dispatch-precedence divergence between `populate` (primary-first) and `generate` / `get` (derived-first) was only observable in this forbidden configuration; converting it into a setup-time error closes the footgun.

Before:

```ts
const Person = z.object({ id: z.uuid(), name: z.string() });
const world = createWorld({ seed: 1 });
world.withSchema(Person);                          // OK — primary
world.withSchema(Person, { from: Company });       // silently accepted; dispatchers later disagreed
```

After:

```ts
world.withSchema(Person);                          // OK — primary
world.withSchema(Person, { from: Company });       // THROWS — already registered as primary
// Reversed order throws symmetrically.
```
