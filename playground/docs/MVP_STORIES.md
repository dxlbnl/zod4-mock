# MVP User Stories & Testing Strategy

This document translates the [MVP Plan](./MVP_PLAN.md) into actionable user stories and defines how we will verify their success.

---

## 👥 User Stories

### Story 1: Scaling the World (Population)

> **As a user**, I want to control the number of subject instances generated so I can test my UI with different data volumes.

- **Success Criteria**:
  - [ ] Each subject in the Left Rail has a visible "Count" input.
  - [ ] Changing the count (e.g., 1 -> 10) immediately updates the "World View" data.
  - [ ] The generated code includes `.populate(Subject, count)` calls.

### Story 2: Wiring Relationships

> **As a user**, I want to define connections between subjects so I can model realistic relational data graphs.

- **Success Criteria**:
  - [ ] Clicking a "Link" icon in the Left Rail opens a simple "Add Relation" form.
  - [ ] I can specify a name (e.g., "author"), a target subject, and cardinality.
  - [ ] The `defineSubjectType` code preview updates with the `relations: { ... }` block.

### Story 3: Binding & Identity (The "Link" UI)

> **As a user**, I want to map my schema fields to subject data and relationships so that identity and foreign keys are consistent across my world.

- **Success Criteria**:
  - [ ] **Relational Flow**: A field like `userId` in `Order` shows a green 🔗 icon when it matches the `User` relation.
  - [ ] **Schema Binding**: I can select a "Base Subject" for any Schema and map its fields to subject keys.
  - [ ] **Zero-Code**: Standard ID alignment is handled by the core library; the UI just shows the "linked" status.

### Story 4: Inspecting the World

> **As a user**, I want to browse all generated data in a single view so I can verify that IDs and relationships are consistent.

- **Success Criteria**:
  - [ ] A "World View" tab exists in the Output Pane.
  - [ ] It displays a flat list (table) of all subject instances in the registry.
  - [ ] I can see that `post#1.authorId` matches the `id` of `user#X` generated in the same world.

---

## 🧪 Testing Strategy

### 1. Component Interaction Tests (Storybook)

We will use Storybook's `play` functions to verify each story's UI logic in isolation.

- **SubjectItem Story**: Test that clicking the count input and entering a number triggers the `onupdatecount` callback.
- **RelationForm Story**: Test that filling the form and clicking "Add" emits the correct relationship definition.
- **MappingIcon Story**: Test that clicking the 🔗 icon opens a menu to select the mapping source (Subject Field or Relationship).

### 2. State Integration Tests (Vitest)

Unit tests for `state.svelte.ts` and `schema-builder.ts` to ensure the core lib features are leveraged correctly.

- **Test Case**: Verify that `buildWorld` produces a `zod4-mock` world where `userId` is automatically populated from the `author` relation.
- **Test Case**: Verify that the generated TypeScript code reflects the new simplified relationship syntax.

### 3. "The Relational Loop" Integration Test

A comprehensive Storybook interaction test (in `Playground.stories.svelte`) that performs the following sequence:

1.  **Add Subject** "User" with 2 fields.
2.  **Add Subject** "Post" with a `userId` field.
3.  **Define Relation** on "Post" named "author" pointing to "User".
4.  **Verify Sinking**: Assert that the 🔗 icon appears automatically on `userId`.
5.  **Scale** "User" to 3 instances and "Post" to 5 instances.
6.  **Switch to World View** and assert that the generated table contains 8 rows total and that the `userId` values in the Post rows are valid User IDs.

### Story 5: Visualizing Relational Flow

> **As a user**, I want to see visual indicators for auto-aligned relational fields so that I can understand and verify the world's referential integrity.

- **Success Criteria**:
  - [ ] Fields auto-aligned via heuristics show a 🔗 **Link Icon** in the builder.
  - [ ] Hovering the icon shows a tooltip: _"Auto-mapped to 'customer' relationship."_
  - [ ] Clicking the icon opens a dropdown to manually select a different relationship or "Random".
