# Subject Relations Enforcement

Currently, `defineSubjectType` accepts a `relations` map, e.g.:

```ts
const PersonSubject = defineSubjectType("person", personSchema, {
  relations: {
    employer: { type: "company", cardinality: "1" },
    reports: { type: "person", cardinality: "0..n" },
  },
});
```

However, these relations are strictly metadata. The generation logic does not enforce cardinalities, nor does it automatically provision related entities. This document outlines the planned architecture for enforcing relations in `zod4-mock`.

## Architectural Goals

1. **Auto-provisioning:** If a `person` subject requires exactly one `company` (`cardinality: "1"`), generating a person should automatically pick an existing company from the registry or generate a new one if none exist.
2. **Deterministic Links:** Relation links must be stable. If `person#1` is assigned `company#2` as an employer, this assignment must persist.
3. **Registry Resolution:** The `.pick()` and `.filter()` methods should be augmented to respect defined relationships.
4. **Cyclic Dependencies:** The system must gracefully handle mutually required relationships without blowing the stack.

## Proposed Implementation

### 1. The Relationship Graph

Upon `world.withSubject()`, the world will construct a dependency graph of subject types based on their defined `relations`. This graph will sort subject generation topologically to ensure dependencies are generated first.

### 2. Auto-Generation of Missing Relations

When `.subject('person')` is called, the world will check the `PersonSubject` relations.
If `employer` is `1` (required), the world will query the registry:

- If a `company` exists, pick it probabilistically.
- If no `company` exists, eagerly generate one via `.subject('company')`.

### 3. Relation Links Storage

Instances will gain an internal `_relations` map:

```ts
interface AnySubjectInstance {
  _type: string;
  _id: string;
  data: unknown;
  _relations: Record<string, string[]>; // e.g. { employer: ["company#1"] }
}
```

This map will be populated at creation time. Matchers can then expose these links:

```ts
.withSchema(PersonApiSchema, PersonSubject, {
  employerId: (s, ctx) => ctx.getRelation(s, 'employer')[0].id
})
```

## Next Steps

- Determine syntax for injecting relational lookups into the user's `generate()` or `derive` flow.
- Ensure PRNG states remain isolated when eagerly generating dependencies.
