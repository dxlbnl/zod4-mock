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

### Story 3: Binding Schemas to Subjects

> **As a user**, I want to map my API schema fields to subject data so I can see how stable identity translates into specific API shapes.

- **Success Criteria**:
  - [ ] I can select a "Base Subject" for any Schema in the Builder Pane.
  - [ ] Schema fields show a "Source" dropdown containing all keys from the bound subject.
  - [ ] The generated data for the schema correctly pulls values from the associated subject instance.

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
- **MappingDropdown Story**: Test that picking a subject key correctly updates the field's binding state.

### 2. State Integration Tests (Vitest)

Unit tests for `state.svelte.ts` to ensure the reactive logic handles complex graphs.

- **Test Case**: Adding a relationship between Subject A and B should correctly update the `relationships` array in the store and trigger a re-generation of the world code.
- **Test Case**: Deleting a subject should automatically clean up any relationships and schema bindings referencing it.

### 3. "The Relational Loop" Integration Test

A comprehensive Storybook interaction test (in `Playground.stories.svelte`) that performs the following sequence:

1.  **Add Subject** "User" with 2 fields.
2.  **Add Subject** "Post" with a `userId` field.
3.  **Define Relation** on "Post" named "author" pointing to "User".
4.  **Scale** "User" to 3 instances and "Post" to 5 instances.
5.  **Switch to World View** and assert that the generated table contains 8 rows total and that the `userId` values in the Post rows are valid User IDs.

### 4. Manual UX Validation

- Verify that "teleporting" (clicking an ID link) feels smooth and doesn't lose context.
- Verify that the "World View" table remains performant with up to 50 items.
