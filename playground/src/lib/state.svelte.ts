/**
 * state.svelte.ts
 * Central reactive state store for the playground, using Svelte 5 $state runes.
 * All mutations go through the exported functions — no direct state mutation from components.
 */

import type { ZodFieldType } from "./field-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModifierDef {
  name: string;
  value?: string | number | boolean;
}

export interface FieldDef {
  id: string;
  kind: "field" | "group";
  key: string;
  type: ZodFieldType;
  modifiers: ModifierDef[];
  indent: number;
  /** For enum fields — the allowed values */
  enumValues: string[];
  /** For object/group fields — nested children */
  children: FieldDef[];
}

export interface SubjectDef {
  id: string;
  name: string;
  /** How many instances to populate */
  count: number;
  fields: FieldDef[];
}

export interface SchemaDef {
  id: string;
  name: string;
  fields: FieldDef[];
}

export interface RelationshipDef {
  id: string;
  /** Subject name (from) */
  from: string;
  cardinality: "1" | "0..1" | "0..n" | "1..n";
  /** Subject name (to) */
  to: string;
  /** Relation name used in defineSubjectType options, e.g. "owner" */
  relationName: string;
}

/**
 * Links a schema to a subject + maps schema field keys → subject field keys.
 * Generates: `world.withSchema(schema, subject, { userId: (s) => s.id, ... })`
 */
export interface SchemaBinding {
  schemaId: string;
  subjectId: string;
  /** { schemaFieldKey: subjectFieldKey } */
  fieldMap: Record<string, string>;
}

export interface WorldConfig {
  seed: number;
  optionalProbability: number;
  defaultArrayLengthMin: number;
  defaultArrayLengthMax: number;
}

export interface UIState {
  exportOpen: boolean;
  outputTab: "code" | "data" | "world";
  sectionStates: Record<string, boolean>;
}

export interface PlaygroundState {
  world: WorldConfig;
  subjects: SubjectDef[];
  activeSubjectId: string | null;
  schemas: SchemaDef[];
  activeSchemaId: string | null;
  /** Which entity type is currently being edited in the builder */
  activeEntityType: "subject" | "schema";
  relationships: RelationshipDef[];
  bindings: SchemaBinding[];
  ui: UIState;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _seq = 0;
function uid(prefix = "id"): string {
  return `${prefix}-${++_seq}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

export function makeField(overrides: Partial<FieldDef> = {}): FieldDef {
  return {
    id: uid("field"),
    kind: "field",
    key: "",
    type: "string",
    modifiers: [],
    indent: 0,
    enumValues: [],
    children: [],
    ...overrides,
  };
}

/** Recursively find a field by ID in a list of fields */
export function findField(fields: FieldDef[], id: string): FieldDef | null {
  for (const f of fields) {
    if (f.id === id) return f;
    if (f.children && f.children.length > 0) {
      const found = findField(f.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ─── Default scenario (mirrors hi-fi mockup) ──────────────────────────────────

export function makeDefaultState(): PlaygroundState {
  const userSubject: SubjectDef = {
    id: uid("subj"),
    name: "User",
    count: 6,
    fields: [
      makeField({ key: "id", type: "uuid" }),
      makeField({ key: "firstName", type: "string" }),
      makeField({ key: "lastName", type: "string" }),
      makeField({ key: "email", type: "email" }),
      makeField({ key: "role", type: "enum", enumValues: ["admin", "member", "viewer"] }),
      makeField({ key: "createdAt", type: "date" }),
    ],
  };

  const orderSubject: SubjectDef = {
    id: uid("subj"),
    name: "Order",
    count: 4,
    fields: [
      makeField({ key: "id", type: "uuid" }),
      makeField({ key: "userId", type: "uuid" }),
      makeField({
        key: "status",
        type: "enum",
        enumValues: ["pending", "shipped", "delivered", "cancelled"],
      }),
      makeField({
        key: "totalCents",
        type: "number",
        modifiers: [{ name: ".int()" }, { name: ".min", value: 0 }],
      }),
      makeField({ key: "createdAt", type: "date" }),
    ],
  };

  const productSubject: SubjectDef = {
    id: uid("subj"),
    name: "Product",
    count: 5,
    fields: [
      makeField({ key: "id", type: "uuid" }),
      makeField({
        key: "name",
        type: "string",
        modifiers: [
          { name: ".min", value: 2 },
          { name: ".max", value: 100 },
        ],
      }),
      makeField({ key: "sku", type: "string" }),
      makeField({
        key: "priceCents",
        type: "number",
        modifiers: [{ name: ".int()" }, { name: ".min", value: 1 }],
      }),
      makeField({ key: "inStock", type: "boolean" }),
    ],
  };

  const userApiSchema: SchemaDef = {
    id: uid("schema"),
    name: "UserApi",
    fields: [
      makeField({ key: "userId", type: "uuid" }),
      makeField({ key: "displayName", type: "string" }),
      makeField({ key: "email", type: "email" }),
      makeField({ key: "avatarUrl", type: "url", modifiers: [{ name: ".optional()" }] }),
      makeField({ key: "role", type: "enum", enumValues: ["admin", "member", "viewer"] }),
    ],
  };

  return {
    world: {
      seed: 42,
      optionalProbability: 0.2,
      defaultArrayLengthMin: 1,
      defaultArrayLengthMax: 5,
    },
    subjects: [userSubject, orderSubject, productSubject],
    activeSubjectId: userSubject.id,
    schemas: [userApiSchema],
    activeSchemaId: null,
    activeEntityType: "subject",
    relationships: [
      {
        id: uid("rel"),
        from: "Order",
        cardinality: "1",
        to: "User",
        relationName: "customer",
      },
    ],
    bindings: [],
    ui: {
      exportOpen: false,
      outputTab: "code",
      sectionStates: { world: false, subjects: true, schemas: false },
    },
  };
}

// ─── State factory ────────────────────────────────────────────────────────────

export function createPlaygroundState(initial?: PlaygroundState) {
  const state = $state<PlaygroundState>(initial ?? makeDefaultState());

  // ── World ──────────────────────────────────────────────────────────────

  function setWorldSeed(seed: number) {
    state.world.seed = seed;
  }
  function setOptionalProbability(p: number) {
    state.world.optionalProbability = Math.max(0, Math.min(1, p));
  }
  function setDefaultArrayLength(min: number, max: number) {
    state.world.defaultArrayLengthMin = Math.max(0, min);
    state.world.defaultArrayLengthMax = Math.max(min, max);
  }

  // ── Subjects ───────────────────────────────────────────────────────────

  function addSubject(name = "NewSubject") {
    const subj: SubjectDef = { id: uid("subj"), name, count: 3, fields: [] };
    state.subjects.push(subj);
    state.activeSubjectId = subj.id;
    state.activeEntityType = "subject";
  }

  function removeSubject(id: string) {
    const idx = state.subjects.findIndex((s) => s.id === id);
    if (idx === -1) return;
    state.subjects.splice(idx, 1);
    // Remove dangling relationships + bindings
    state.relationships = state.relationships.filter(
      (r) => r.from !== state.subjects[idx]?.name && r.to !== state.subjects[idx]?.name,
    );
    state.bindings = state.bindings.filter((b) => b.subjectId !== id);
    // Reselect
    if (state.activeSubjectId === id) {
      state.activeSubjectId = state.subjects[0]?.id ?? null;
    }
  }

  function renameSubject(id: string, name: string) {
    const subj = state.subjects.find((s) => s.id === id);
    if (!subj) return;
    const old = subj.name;
    subj.name = name;
    // Update relationship references
    for (const rel of state.relationships) {
      if (rel.from === old) rel.from = name;
      if (rel.to === old) rel.to = name;
    }
  }

  function setSubjectCount(id: string, count: number) {
    const subj = state.subjects.find((s) => s.id === id);
    if (subj) subj.count = Math.max(1, count);
  }

  function setActiveSubject(id: string) {
    state.activeSubjectId = id;
    state.activeEntityType = "subject";
    state.activeSchemaId = null;
  }

  // ── Schemas ────────────────────────────────────────────────────────────

  function addSchema(name = "NewSchema") {
    const schema: SchemaDef = { id: uid("schema"), name, fields: [] };
    state.schemas.push(schema);
    state.activeSchemaId = schema.id;
    state.activeEntityType = "schema";
    state.activeSubjectId = null;
  }

  function removeSchema(id: string) {
    const idx = state.schemas.findIndex((s) => s.id === id);
    if (idx === -1) return;
    state.schemas.splice(idx, 1);
    state.bindings = state.bindings.filter((b) => b.schemaId !== id);
    if (state.activeSchemaId === id) {
      state.activeSchemaId = null;
    }
  }

  function renameSchema(id: string, name: string) {
    const schema = state.schemas.find((s) => s.id === id);
    if (schema) schema.name = name;
  }

  function setActiveSchema(id: string) {
    state.activeSchemaId = id;
    state.activeEntityType = "schema";
    state.activeSubjectId = null;
  }

  // ── Fields (shared for subjects + schemas) ─────────────────────────────

  function _getFields(entityType: "subject" | "schema", entityId: string): FieldDef[] | null {
    if (entityType === "subject") {
      return state.subjects.find((s) => s.id === entityId)?.fields ?? null;
    }
    return state.schemas.find((s) => s.id === entityId)?.fields ?? null;
  }

  function addField(entityType: "subject" | "schema", entityId: string, parentId?: string) {
    const fields = _getFields(entityType, entityId);
    if (!fields) return null;

    if (parentId) {
      const parent = findField(fields, parentId);
      if (parent && parent.kind === "group") {
        const newField = makeField({ indent: parent.indent + 1 });
        parent.children.push(newField);
        return newField.id;
      }
    }

    const newField = makeField();
    fields.push(newField);
    return newField.id;
  }

  function removeField(entityType: "subject" | "schema", entityId: string, fieldId: string) {
    const fields = _getFields(entityType, entityId);
    if (!fields) return;

    function recursiveRemove(list: FieldDef[]): boolean {
      const idx = list.findIndex((f) => f.id === fieldId);
      if (idx !== -1) {
        list.splice(idx, 1);
        return true;
      }
      for (const f of list) {
        if (f.children && f.children.length > 0) {
          if (recursiveRemove(f.children)) return true;
        }
      }
      return false;
    }

    recursiveRemove(fields);
  }

  function updateField(
    entityType: "subject" | "schema",
    entityId: string,
    fieldId: string,
    patch: Partial<Pick<FieldDef, "key" | "type" | "enumValues" | "kind">>,
  ) {
    const fields = _getFields(entityType, entityId);
    if (!fields) return;
    const field = findField(fields, fieldId);
    if (!field) return;
    Object.assign(field, patch);

    if (patch.type) {
      const isGroup = patch.type === "object" || patch.type === "array";
      field.kind = isGroup ? "group" : "field";
      if (isGroup && !field.children) {
        field.children = [];
      }
    }
  }

  function addModifier(
    entityType: "subject" | "schema",
    entityId: string,
    fieldId: string,
    modifier: ModifierDef,
  ) {
    const fields = _getFields(entityType, entityId);
    if (!fields) return;
    const field = findField(fields, fieldId);
    if (field) field.modifiers.push(modifier);
  }

  function removeModifier(
    entityType: "subject" | "schema",
    entityId: string,
    fieldId: string,
    modifierIndex: number,
  ) {
    const fields = _getFields(entityType, entityId);
    if (!fields) return;
    const field = findField(fields, fieldId);
    if (field) field.modifiers.splice(modifierIndex, 1);
  }

  function updateModifierValue(
    entityType: "subject" | "schema",
    entityId: string,
    fieldId: string,
    modifierIndex: number,
    value: string | number | boolean,
  ) {
    const fields = _getFields(entityType, entityId);
    if (!fields) return;
    const field = findField(fields, fieldId);
    if (field?.modifiers[modifierIndex]) {
      const mod = field.modifiers[modifierIndex];
      let finalValue: string | number | boolean = value;

      if (typeof value === "string") {
        const isNumericMod = [".min", ".max", ".length", ".multipleOf"].includes(mod.name);
        const isDefault = mod.name === ".default";

        if (isNumericMod || (isDefault && field.type === "number")) {
          const num = parseFloat(value);
          if (!isNaN(num)) finalValue = num;
        } else if (isDefault && field.type === "boolean") {
          if (value.toLowerCase() === "true") finalValue = true;
          if (value.toLowerCase() === "false") finalValue = false;
        }
      }

      mod.value = finalValue;
    }
  }

  // ── Relationships ──────────────────────────────────────────────────────

  function addRelationship(initial: Partial<Omit<RelationshipDef, "id">> = {}) {
    const names = state.subjects.map((s) => s.name);
    state.relationships.push({
      id: uid("rel"),
      from: initial.from ?? names[0] ?? "",
      cardinality: initial.cardinality ?? "1",
      to: initial.to ?? names[1] ?? names[0] ?? "",
      relationName: initial.relationName ?? "relation",
    });
  }

  function updateRelationship(
    id: string,
    patch: Partial<Pick<RelationshipDef, "from" | "to" | "cardinality" | "relationName">>,
  ) {
    const rel = state.relationships.find((r) => r.id === id);
    if (rel) Object.assign(rel, patch);
  }

  function removeRelationship(id: string) {
    const idx = state.relationships.findIndex((r) => r.id === id);
    if (idx !== -1) state.relationships.splice(idx, 1);
  }

  // ── Bindings ───────────────────────────────────────────────────────────

  function bindSchemaToSubject(schemaId: string, subjectId: string | null) {
    const idx = state.bindings.findIndex((b) => b.schemaId === schemaId);
    if (subjectId === null) {
      if (idx !== -1) state.bindings.splice(idx, 1);
      return;
    }

    if (idx !== -1) {
      state.bindings[idx].subjectId = subjectId;
      state.bindings[idx].fieldMap = {};
    } else {
      state.bindings.push({ schemaId, subjectId, fieldMap: {} });
    }
  }

  function setFieldMapping(schemaId: string, schemaFieldKey: string, subjectFieldKey: string) {
    const binding = state.bindings.find((b) => b.schemaId === schemaId);
    if (binding) binding.fieldMap[schemaFieldKey] = subjectFieldKey;
  }

  function removeFieldMapping(schemaId: string, schemaFieldKey: string) {
    const binding = state.bindings.find((b) => b.schemaId === schemaId);
    if (binding) delete binding.fieldMap[schemaFieldKey];
  }

  // ── UI ─────────────────────────────────────────────────────────────────

  function setOutputTab(tab: "code" | "data" | "world") {
    state.ui.outputTab = tab;
  }

  function setExportOpen(open: boolean) {
    state.ui.exportOpen = open;
  }

  function toggleSection(id: string) {
    state.ui.sectionStates[id] = !state.ui.sectionStates[id];
  }

  // ── Derived helpers ────────────────────────────────────────────────────

  /** The currently active subject or null */
  const activeSubject = $derived(
    state.activeEntityType === "subject"
      ? (state.subjects.find((s) => s.id === state.activeSubjectId) ?? null)
      : null,
  );

  /** The currently active schema or null */
  const activeSchema = $derived(
    state.activeEntityType === "schema"
      ? (state.schemas.find((s) => s.id === state.activeSchemaId) ?? null)
      : null,
  );

  /** Fields being edited in the builder right now */
  const activeFields = $derived(activeSubject?.fields ?? activeSchema?.fields ?? []);

  /** Builder pane title */
  const builderTitle = $derived(
    state.activeEntityType === "subject"
      ? (activeSubject?.name ?? "Builder")
      : (activeSchema?.name ?? "Builder"),
  );

  /** Binding for the active schema (if any) */
  const activeBinding = $derived(
    activeSchema ? (state.bindings.find((b) => b.schemaId === activeSchema.id) ?? null) : null,
  );

  return {
    // Expose raw state for reading
    get state() {
      return state;
    },

    // Derived
    get activeSubject() {
      return activeSubject;
    },
    get activeSchema() {
      return activeSchema;
    },
    get activeFields() {
      return activeFields;
    },
    get builderTitle() {
      return builderTitle;
    },
    get activeBinding() {
      return activeBinding;
    },

    // Mutations
    setWorldSeed,
    setOptionalProbability,
    setDefaultArrayLength,

    addSubject,
    removeSubject,
    renameSubject,
    setSubjectCount,
    setActiveSubject,

    addSchema,
    removeSchema,
    renameSchema,
    setActiveSchema,

    addField,
    removeField,
    updateField,
    addModifier,
    removeModifier,
    updateModifierValue,

    addRelationship,
    updateRelationship,
    removeRelationship,

    bindSchemaToSubject,
    setFieldMapping,
    removeFieldMapping,

    setOutputTab,
    setExportOpen,
    toggleSection,
  };
}

export type PlaygroundStore = ReturnType<typeof createPlaygroundState>;
