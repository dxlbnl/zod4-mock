# zod4-mock Playground — Implementation Plan

Component-first, bottom-up: each phase builds one composite component with stories + interaction tests. User stories define the verification criteria. Wire together last.

---

## Resolved Questions

| Question | Decision |
|---|---|
| Schemas section | First-class — schemas are plain schemas built with the builder. Link to subjects with simple property matching. |
| Relationship editing | Dropdown selects for `from`/`to`/`cardinality` |
| Auto-run vs manual | Always auto-run (remove toggle entirely) |
| Enum values | Modifier pills, consistent with all other modifiers |

---

## Data Model

### Subjects vs Schemas — how they differ

Both are built with the same builder UI — the difference is their role:

| | Subject | Schema |
|---|---|---|
| Library API | `defineSubjectType(name, z.object({...}))` | Plain `z.object({...})` passed to `withSchema()` |
| Purpose | Identity anchor — stable data to derive from | API shape — what your endpoint returns |
| Fields | Always fully populated (optionalProbability = 0) | Can have optional/nullable fields |
| Binding | Registered via `world.withSubject()` | Bound to a subject via `world.withSchema(schema, subject, matchers)` |
| Matching | N/A | Each schema field can map to a subject field (simple `(s) => s.fieldName` matcher) |

### How simple property matching works

For each entry in `SchemaBinding.fieldMap`, the codegen produces a matcher:

```typescript
// fieldMap: { "userId": "id", "email": "email" }
// →
world.withSchema(UserApiSchema, UserSubject, {
  userId: (s) => s.id,
  email: (s) => s.email,
})
```

Fields **not** in the `fieldMap` fall through to key heuristics → schema-based generation.

### State Shape

```typescript
interface PlaygroundState {
  world: {
    seed: number;
    optionalProbability: number;
    defaultArrayLength: [number, number];
  };
  subjects: SubjectDef[];
  activeSubjectId: string | null;
  schemas: SchemaDef[];
  activeSchemaId: string | null;
  activeEntityType: 'subject' | 'schema';
  relationships: RelationshipDef[];
  bindings: SchemaBinding[];
  ui: {
    exportOpen: boolean;
    outputTab: 'code' | 'data';
    sectionStates: Record<string, boolean>;
  };
}

interface SubjectDef {
  id: string;
  name: string;
  count: number;
  fields: FieldDef[];
}

interface SchemaDef {
  id: string;
  name: string;
  fields: FieldDef[];
}

interface FieldDef {
  id: string;
  kind: 'field' | 'group';
  key: string;
  type: ZodFieldType;
  modifiers: ModifierDef[];
  indent: number;
  children?: FieldDef[];
  enumValues?: string[];
}

interface ModifierDef {
  name: string;
  value?: string | number;
}

interface RelationshipDef {
  id: string;
  from: string;
  to: string;
  cardinality: '1' | '0..1' | '0..n' | '1..n';
}

interface SchemaBinding {
  schemaId: string;
  subjectId: string;
  fieldMap: Record<string, string>;
}
```

---

## Phases

---

### Phase 0 — State & Codegen Core (no UI)

Pure TypeScript modules — unit-testable with vitest.

#### [NEW] `src/lib/state.svelte.ts`

Central `$state` runes store. Exports `createPlaygroundState(initialData?)`:
- Mutation functions: `addSubject`, `removeSubject`, `addField`, `updateField`, `addModifier`, etc.
- Default scenario matching the hi-fi mockup (User/Order/Product + UserApi schema)

#### [NEW] `src/lib/codegen.ts`

Pure functions:
- `generateSubjectCode(subject)` → `defineSubjectType("User", z.object({...}))`
- `generateSchemaCode(schema)` → `const UserApiSchema = z.object({...})`
- `generateWorldCode(state)` → `createWorld({...}).withSubject(...).withSchema(...)`
- `generateFullExport(state)` → Complete `world.ts` file
- `generateTokenizedCode(subject)` → Tokenized for syntax highlighting

#### [NEW] `src/lib/schema-builder.ts`

State → real Zod schemas at runtime for live data generation:
- `buildZodSchema(fields: FieldDef[]): ZodObject`
- `buildWorld(state: PlaygroundState): World`

#### [NEW] `src/lib/field-types.ts`

Static catalog of supported types + their available modifiers. Drives TypeChip dropdowns and FloatingMenu items.

#### Verify

```bash
cd playground && pnpm check
cd playground && pnpm test:unit -- --run --project unit   # pure TS unit tests (no browser)
```

---

### Phase 1 — BuilderPane

The primary editing surface. Composes existing `PropertyRow`, `GroupHeader`, `FloatingMenu`, `AddMod`.

#### [NEW] `src/lib/components/App/BuilderPane.svelte`

Props: `fields`, `title`, `accentTitle`, `subtitle`. Callbacks for all field mutations.

#### [NEW] `src/lib/components/App/BuilderPane.stories.svelte`

Stories: **Default** (User fields), **Empty**, **With Float Menu**, **Nested Object**

#### User Stories

**BP-1 · Add a property**
As a user, I want to click "add property" so that a new empty field row appears.
- [ ] Clicking the dashed button appends a new `PropertyRow`
- [ ] New row has empty key input, focused automatically, default type `String`
- [ ] Code output updates to include the new field

**BP-2 · Rename a field key**
As a user, I want to click a field's key name and type a new name so that the property name updates everywhere.
- [ ] Key input is inline-editable
- [ ] On blur/Enter, key updates in state
- [ ] Code and data reflect the new key
- [ ] Heuristic matches (e.g. `email`) produce appropriate data

**BP-3 · Change a field's type**
As a user, I want to click the type chip so that I can pick a different Zod type.
- [ ] Clicking `TypeChip` opens a type picker
- [ ] Available: String, Number, Boolean, Date, UUID, Email, Enum, Object, Array
- [ ] Selecting a type clears incompatible modifiers
- [ ] Changing to Object converts row into `GroupHeader` with children
- [ ] Changing to Enum prompts for initial values (modifier pills)

**BP-4 · Select a field row**
As a user, I want to click a row to select it so that I see context in code/data views.
- [ ] Clicking a row sets `data-selected="true"`
- [ ] Only one row selected at a time
- [ ] `+ mod` pill on selected row becomes active
- [ ] Code view highlights corresponding line
- [ ] Data view highlights matching field

**BP-5 · Add a modifier**
As a user, I want to click `+ mod` so that a floating menu appears with available modifiers.
- [ ] `+ mod` opens `FloatingMenu` anchored below the pill
- [ ] Menu shows modifiers for current field type
- [ ] Scope chip shows Zod base type (e.g. `z.number()`)
- [ ] Filter input narrows the list
- [ ] Enter/click adds modifier as `ModifierPill`
- [ ] Modifiers with values show inline input after adding
- [ ] Escape closes without adding
- [ ] Arrow keys navigate items

**BP-6 · Remove a modifier**
As a user, I want to click × on a modifier pill so that the modifier is removed.
- [ ] × appears on pills when row is selected
- [ ] Clicking × removes the modifier
- [ ] Code and data update

**BP-7 · Edit a modifier's value**
As a user, I want to click a modifier's value so that I can change the constraint inline.
- [ ] Value is editable inline
- [ ] Enter/blur commits
- [ ] Invalid values rejected
- [ ] Code and data update

**BP-8 · Reorder fields (stretch)**
As a user, I want to drag a row by its grip handle so that I can reorder properties.
- [ ] Grip appears on hover
- [ ] Dragging moves the row
- [ ] Nested fields move with parent

**BP-9 · Remove a field**
As a user, I want to delete a selected field so that it's removed from the schema.
- [ ] Selected row shows delete affordance
- [ ] Removing a group removes all children
- [ ] Code and data update

**BP-10 · Nested object fields**
As a user, I want to add a field with type Object so that I can define nested properties.
- [ ] Type Object converts row into `GroupHeader`
- [ ] Indented "add property" button appears below group
- [ ] Child fields are indented one level
- [ ] Code renders nested `z.object({...})` correctly
- [ ] Collapse chevron hides/shows children

---

### Phase 2 — CodeView

Syntax-highlighted read-only code output.

#### [NEW] `src/lib/components/App/CodeView.svelte`

Props: `lines: CodeLine[]`, `activeLineIndex?: number`

#### [NEW] `src/lib/components/App/CodeView.stories.svelte`

Stories: **Default** (User schema), **Active Line**, **Empty**

#### User Stories

**CV-1 · See generated code in real time**
As a user, I want to see TypeScript code update as I edit so that I understand what my schema produces.
- [ ] Code renders with syntax highlighting (`--syn-keyword`, `--syn-string`, etc.)
- [ ] Line numbers in gutter column
- [ ] Updates reactively when fields/modifiers change
- [ ] Import statement always present

**CV-2 · Active line follows selection**
As a user, I want the code line for my selected field highlighted so I can correlate fields to code.
- [ ] Selected row → corresponding code line gets active background
- [ ] Code view auto-scrolls to keep active line visible
- [ ] Deselecting removes highlight

---

### Phase 3 — DataView

JSON tree showing live mock data from the actual `zod4-mock` library.

#### [NEW] `src/lib/components/App/DataView.svelte`

Props: `data: unknown[]`, `highlightField?: string`

#### [NEW] `src/lib/components/App/DataView.stories.svelte`

Stories: **Default** (3 user records), **Single Record**, **Empty**, **Highlighted**

#### User Stories

**DV-1 · Preview generated mock data**
As a user, I want to see real mock data so that I can verify the output.
- [ ] Data rendered as syntax-highlighted JSON
- [ ] Keys colored distinctly from values
- [ ] Data generated by calling `createWorld()` + `world.generate()` in browser
- [ ] Record count matches subject's `count` setting
- [ ] Same seed → same output

**DV-2 · Field highlight follows selection**
As a user, I want my selected field highlighted in the data so I see what values it produces.
- [ ] Matching key in each record gets highlighted background
- [ ] Nested fields highlight correctly (e.g. `address.street`)

**DV-3 · Relation annotations**
As a user, I want inline comments on relation fields so I understand cross-subject references.
- [ ] Array fields show count annotation (e.g. `// → 3 Order rows`)
- [ ] Empty relations show `// ∅`

---

### Phase 4 — OutputPane

Container with tab switching between Code and Data views.

#### [NEW] `src/lib/components/App/OutputPane.svelte`

Composes: `OutputTabs` + `CodeView` / `DataView`, `Button`, `Kbd`

#### [NEW] `src/lib/components/App/OutputPane.stories.svelte`

Stories: **Code Tab**, **Data Tab**, **With Actions**

#### User Stories

**OP-1 · Switch between code and data tabs**
As a user, I want to click Code or Data tabs to alternate views.
- [ ] Code tab shows `CodeView`, Data tab shows `DataView`
- [ ] Active tab has accent underline + dot indicator
- [ ] Tab metadata shows filename / record count

**OP-2 · Copy output to clipboard**
As a user, I want to click copy so the current output is on my clipboard.
- [ ] Copy copies active tab's raw content (no line numbers for code)

**OP-3 · Download output as file**
As a user, I want to click download so I get a file.
- [ ] Code tab → `{name}.schema.ts`
- [ ] Data tab → `{name}.data.json`

---

### Phase 5 — LeftRail (Live)

Enhance existing `LeftRail` with full interactivity across all three sections.

#### [NEW] `src/lib/components/App/WorldConfig.svelte`

Seed input, optional probability, array length range.

#### [NEW] `src/lib/components/App/RelationshipRow.svelte`

Dropdown selects for from/cardinality/to + remove button.

#### [NEW] `src/lib/components/App/SchemaItem.svelte`

Like `SubjectItem` but for schemas. Shows bound subject as badge.

#### [MODIFY] `src/lib/components/Surfaces/LeftRail.svelte`

Add World content, Relationships sub-section, Schemas section.

#### Stories for each new component + updated LeftRail story

#### User Stories — World

**LR-1 · Configure seed**
As a user, I want to change the seed so I get a different dataset.
- [ ] Expanding World accordion reveals seed input
- [ ] Changing seed regenerates all data
- [ ] StatusBar shows new seed
- [ ] Export code uses new seed

**LR-2 · Configure optional probability**
As a user, I want to adjust optional probability to control field omission.
- [ ] Number input, range 0–1
- [ ] 0 → always present; 1 → always omitted
- [ ] Export includes `optionalProbability` when non-default

**LR-3 · Configure default array length**
As a user, I want to set array length range for unconstrained arrays.
- [ ] Two number inputs (min, max), clamped
- [ ] Export includes `defaultArrayLength` when non-default

#### User Stories — Subjects

**LR-4 · Select a subject**
As a user, I want to click a subject so the builder loads its fields.
- [ ] Click highlights with `aria-selected="true"`
- [ ] Builder title updates to "Builder · {Name}"
- [ ] Builder rows switch to subject's fields
- [ ] Code/data output switch to subject's schema

**LR-5 · Add a subject**
As a user, I want to click "add subject" to define a new entity.
- [ ] Appends subject with default name, immediately editable
- [ ] Starts with zero fields, auto-selected
- [ ] Accordion header count increments

**LR-6 · Rename a subject**
As a user, I want to rename a subject inline.
- [ ] Name becomes text input on interaction
- [ ] Enter/blur commits
- [ ] Builder title, code output, and relationships update

**LR-7 · Change population count**
As a user, I want to edit the count badge to control instance count.
- [ ] Count badge is editable
- [ ] Changes `world.populate()` in generated code
- [ ] Data output shows new record count

**LR-8 · Remove a subject**
As a user, I want to remove a subject I don't need.
- [ ] Delete affordance exists
- [ ] Removes relationships and schema bindings
- [ ] Next subject selected (or empty state)

#### User Stories — Relationships

**LR-9 · Add a relationship**
As a user, I want to click + next to "Relationships" to declare a relation.
- [ ] New row with three dropdowns: from, cardinality, to
- [ ] Dropdowns populated from current subjects
- [ ] Header count updates
- [ ] Code includes relation in `defineSubjectType` options

**LR-10 · Edit a relationship**
As a user, I want to change a relationship's endpoints or cardinality.
- [ ] Changing any dropdown updates immediately
- [ ] Code and data reflect changes

**LR-11 · Remove a relationship**
As a user, I want to remove a relationship.
- [ ] × button removes it
- [ ] Code no longer includes the relation

#### User Stories — Schemas

**LR-12 · Add a schema**
As a user, I want to add a new API schema to define a response shape.
- [ ] "add schema" appends with default name, editable
- [ ] Selecting switches builder to schema's fields
- [ ] Builder title changes context

**LR-13 · Bind a schema to a subject**
As a user, I want to link my schema to a subject for identity derivation.
- [ ] Badge/dropdown for binding
- [ ] Selecting creates `SchemaBinding`
- [ ] Badge shows bound subject (e.g. `→ User`)
- [ ] Code includes `world.withSchema()`

**LR-14 · Map schema fields to subject fields**
As a user, I want to map a schema field to a subject field for property matching.
- [ ] Bound schema fields show a link indicator
- [ ] Click opens dropdown with subject's field names
- [ ] Selecting creates a match entry
- [ ] Matched fields show visual indicator
- [ ] Code shows `userId: (s) => s.id` in matchers
- [ ] Unmatched fields have no matcher (fall through)

---

### Phase 6 — AppShell + ExportSheet (Wiring)

Connect everything with the reactive state store.

#### [MODIFY] `src/routes/+page.svelte`

Full app layout. Initializes state, passes slices to components, auto-run via `$effect`.

#### [MODIFY] `src/routes/+layout.svelte` — Import `app.css`

#### [MODIFY] `src/lib/components/Surfaces/TopBar.svelte` — Remove auto/manual toggle

#### [MODIFY] `src/lib/components/Surfaces/ExportSheet.svelte` — Wire to codegen

#### [NEW] `src/lib/components/App/ExportContent.svelte` — Export sheet body

#### User Stories — Export

**EX-1 · Open export sheet**
As a user, I want to click "Export all" so I see a full code preview.
- [ ] ExportSheet opens with backdrop blur + scale/fade animation
- [ ] Header shows file info (e.g. `single file · world.ts · 194 lines`)
- [ ] Escape or backdrop click closes

**EX-2 · Preview full export**
As a user, I want to see the complete `world.ts` in the preview.
- [ ] Syntax-highlighted TypeScript
- [ ] Includes imports, subjects, schemas, world setup, generation calls
- [ ] TOC sidebar lists all subjects and schemas

**EX-3 · Toggle inclusions**
As a user, I want to toggle schemas/world on/off to export just what I need.
- [ ] Toggling Schemas off removes definitions from preview
- [ ] Toggling Generated world off removes `createWorld()` calls
- [ ] Line count and TOC update

**EX-4 · Copy export**
As a user, I want to click Copy so the full code is on my clipboard.
- [ ] Copies full file as plain text
- [ ] Brief "Copied!" confirmation

**EX-5 · Download export**
As a user, I want to click Download so I get `world.ts` on disk.
- [ ] Browser download triggers
- [ ] File named `world.ts`, content matches preview

#### User Stories — StatusBar

**SB-1 · Validation status**
As a user, I want to see whether my schema is valid at a glance.
- [ ] `● valid` (green) when schemas build successfully
- [ ] `● error` (amber) when building/generation fails
- [ ] Hover shows error message

**SB-2 · World summary metrics**
As a user, I want quick overview counts in the status bar.
- [ ] Shows: `N subjects │ N schemas │ N relationships │ seed N`
- [ ] All values reactive
- [ ] Right side shows `z@4.x`

#### User Stories — TopBar

**TB-1 · Toggle theme**
As a user, I want to switch between dark and light mode.
- [ ] Click toggles `html.light` class
- [ ] All components update to light tokens
- [ ] Preference persists (localStorage)

---

## File Summary

### New Files (16)

| File | Phase |
|---|---|
| `src/lib/state.svelte.ts` | 0 |
| `src/lib/codegen.ts` | 0 |
| `src/lib/schema-builder.ts` | 0 |
| `src/lib/field-types.ts` | 0 |
| `src/lib/components/App/BuilderPane.svelte` + `.stories.svelte` | 1 |
| `src/lib/components/App/CodeView.svelte` + `.stories.svelte` | 2 |
| `src/lib/components/App/DataView.svelte` + `.stories.svelte` | 3 |
| `src/lib/components/App/OutputPane.svelte` + `.stories.svelte` | 4 |
| `src/lib/components/App/WorldConfig.svelte` | 5 |
| `src/lib/components/App/RelationshipRow.svelte` | 5 |
| `src/lib/components/App/SchemaItem.svelte` | 5 |
| `src/lib/components/App/ExportContent.svelte` | 6 |

### Modified Files (5)

| File | Phase |
|---|---|
| `src/routes/+page.svelte` | 6 |
| `src/routes/+layout.svelte` | 6 |
| `src/lib/components/Surfaces/TopBar.svelte` | 6 |
| `src/lib/components/Surfaces/LeftRail.svelte` | 5 |
| `src/lib/components/Surfaces/ExportSheet.svelte` | 6 |

---

## Verification

Two vitest projects, configured in `vite.config.ts`:

| Project | Runner | Scope | Files |
|---|---|---|---|
| `unit` | Node (no browser) | Pure TS: codegen, schema-builder, state | `src/lib/**/*.test.ts` |
| `storybook` | Chromium (Playwright) | Component interactions via stories | `*.stories.svelte` |

```bash
# Phase 0 — pure logic
cd playground && pnpm check
cd playground && pnpm test:unit -- --run --project unit

# Phases 1–6 — component interactions
cd playground && pnpm test:unit -- --run --project storybook

# Both together
cd playground && pnpm test:unit -- --run
```

User story acceptance criteria checkboxes are the per-phase gates. All criteria for a phase must pass before starting the next.
