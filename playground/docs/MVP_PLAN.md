# Playground MVP: Core Feature Set

To make the playground a functional tool for testing `zod4-mock`, we need to move beyond simple schema building and implement the "World" loop. This MVP focuses on the absolute essentials required to see the library's relational power in action.

## 🎯 The "Relational Loop" Goal
The MVP is successful if a user can:
1. Create a `User` and a `Post`.
2. Connect `Post` to `User`.
3. Generate 5 Users and 10 Posts.
4. See that the Posts' `userIds` correctly reference the Users' `ids`.

---

## 🏗️ MVP Feature Selection

### 1. Subject Connectivity (Pillar 1)
- **Population Input**: A simple number input on each subject in the Left Rail. This allows the user to scale their world.
- **Basic Relation Form**: A simplified version of the Relationship Manager. Just a "Link" icon in the rail that opens a form: `[Relation Name] [Target Subject] [Cardinality]`.
- **Registry Table**: A single "World View" tab that shows a flat list of all generated objects, sorted by type. 

### 2. Schema-to-Subject Binding (Pillar 2)
- **Subject Picker for Schemas**: A dropdown in the Schema header to select which Subject it represents.
- **Key Mapping Dropdown**: In the Builder, a simple dropdown for each schema field to select a key from the bound subject (e.g., `authorId` -> `s.id`).
- **Raw Logic Input**: Instead of a full Monaco editor, use a simple `textarea` for writing custom matcher/derivation strings.

### 3. Unified Export (Pillar 4)
- **One-click world.ts**: The existing export functionality is already near-MVP. It just needs to correctly include the new relations and bindings.

---

## 🚫 Out of Scope for MVP
To keep the build focused, the following "High Polish" features will be deferred:
- **World Graph**: No node-based visualization (Table only).
- **Monaco Integration**: No advanced IntelliSense (Textarea only).
- **PRNG Visualizer**: No deep-dive into seeds.
- **Sandbox Mode**: No ad-hoc override testing.
- **Validation Bar**: No real-time "Health" indicators.

---

## 🛠️ Step-by-Step Implementation Path

1.  **State Update**: Finalize `state.svelte.ts` to support relations and bindings (largely done).
2.  **The "Pop" Control**: Add the count input to the `SubjectItem.svelte`.
3.  **The Relation Form**: Build a simple component to add/edit relations in the `LeftRail`.
4.  **The Binding UI**: Add the "Source" dropdown to `PropertyRow.svelte` for schemas.
5.  **The Registry Tab**: Build the `DataView` extension to show the full registry bucket.
