/**
 * state.svelte.ts
 * Central reactive state store for the playground, using Svelte 5 $state runes.
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
  enumValues: string[];
  children: FieldDef[];

  /**
   * Matcher metadata for the new core API.
   * - If schema.derivedFrom is set, sourceMapping is the key in the source object.
   * - If relationMapping is set, this field is a foreign key for that relation.
   */
  sourceMapping?: string;
  relationMapping?: {
    relationName: string;
    targetFieldKey: string;
  };
}

export interface SchemaRelation {
  name: string;
  targetSchemaId: string;
}

export interface SchemaDef {
  id: string;
  name: string;
  fields: FieldDef[];
  /** How many instances to populate in the world registry */
  populateCount: number;
  /** ID of another schema this is derived from (projection) */
  derivedFrom?: string;
  /** List of named relations to other schemas */
  relations: SchemaRelation[];
}

export interface WorldConfig {
  seed: number;
  optionalProbability: number;
  defaultArrayLengthMin: number;
  defaultArrayLengthMax: number;
  zodVersion: string;
}

export interface UIState {
  exportOpen: boolean;
  outputTab: "code" | "data" | "world";
  activeMobileTab: "config" | "editor" | "output";
}

export interface PlaygroundState {
  world: WorldConfig;
  schemas: SchemaDef[];
  activeSchemaId: string | null;
  ui: UIState;
  /** The dynamic Zod instance */
  z: any;
  availableZodVersions: string[];
  isZodLoading: boolean;
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

// ─── Default scenario ─────────────────────────────────────────────────────────

export function makeDefaultState(): PlaygroundState {
  const userSchema: SchemaDef = {
    id: uid("schema"),
    name: "User",
    populateCount: 6,
    relations: [],
    fields: [
      makeField({ key: "id", type: "uuid" }),
      makeField({ key: "firstName", type: "string" }),
      makeField({ key: "lastName", type: "string" }),
      makeField({ key: "email", type: "email" }),
      makeField({
        key: "role",
        type: "enum",
        enumValues: ["admin", "member", "viewer"],
      }),
      makeField({ key: "createdAt", type: "date" }),
    ],
  };

  const productSchema: SchemaDef = {
    id: uid("schema"),
    name: "Product",
    populateCount: 5,
    relations: [],
    fields: [
      makeField({ key: "id", type: "uuid" }),
      makeField({ key: "name", type: "string" }),
      makeField({ key: "sku", type: "string" }),
      makeField({
        key: "priceCents",
        type: "number",
        modifiers: [{ name: ".int()" }, { name: ".min", value: 1 }],
      }),
      makeField({ key: "inStock", type: "boolean" }),
    ],
  };

  const orderSchema: SchemaDef = {
    id: uid("schema"),
    name: "Order",
    populateCount: 4,
    relations: [
      { name: "customer", targetSchemaId: userSchema.id },
      { name: "items", targetSchemaId: productSchema.id },
    ],
    fields: [
      makeField({ key: "id", type: "uuid" }),
      makeField({
        key: "userId",
        type: "uuid",
        relationMapping: { relationName: "customer", targetFieldKey: "id" },
      }),
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
    ],
  };

  const userApiSchema: SchemaDef = {
    id: uid("schema"),
    name: "UserApi",
    populateCount: 0,
    derivedFrom: userSchema.id,
    relations: [],
    fields: [
      makeField({ key: "userId", type: "uuid", sourceMapping: "id" }),
      makeField({ key: "displayName", type: "string", sourceMapping: "firstName" }),
      makeField({ key: "email", type: "email", sourceMapping: "email" }),
    ],
  };

  return {
    world: {
      seed: 42,
      optionalProbability: 0.2,
      defaultArrayLengthMin: 1,
      defaultArrayLengthMax: 5,
      zodVersion: "4.4.3",
    },
    schemas: [userSchema, productSchema, orderSchema, userApiSchema],
    activeSchemaId: userSchema.id,
    ui: {
      exportOpen: false,
      outputTab: "data",
      activeMobileTab: "editor",
    },
    z: null,
    availableZodVersions: [],
    isZodLoading: false,
  };
}

import { z as staticZod } from "zod";

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

  async function fetchAvailableZodVersions() {
    try {
      const res = await fetch("https://registry.npmjs.org/zod");
      const data = await res.json();
      const versions = Object.keys(data.versions)
        .filter((v) => v.startsWith("4."))
        .reverse();
      state.availableZodVersions = versions;
    } catch (e) {
      console.error("Failed to fetch zod versions", e);
      state.availableZodVersions = ["4.4.3", "4.4.2", "4.4.1", "4.4.0", "4.0.0"];
    }
  }

  async function setZodVersion(version: string) {
    if (state.world.zodVersion === version && state.z) return;
    state.world.zodVersion = version;
    state.isZodLoading = true;
    try {
      const module = await import(/* @vite-ignore */ `https://esm.sh/zod@${version}`);
      state.z = module.z || module.default || module;
    } catch (e) {
      console.error(`Failed to load zod@${version}, falling back to bundled`, e);
      state.z = staticZod;
    } finally {
      state.isZodLoading = false;
    }
  }

  if (!state.z) {
    state.z = staticZod;
    if (!state.world.zodVersion) state.world.zodVersion = "4.4.3";
  }

  // ── Schemas ────────────────────────────────────────────────────────────

  function addSchema(name = "NewSchema") {
    const schema: SchemaDef = {
      id: uid("schema"),
      name,
      fields: [],
      populateCount: 0,
      relations: [],
    };
    state.schemas.push(schema);
    state.activeSchemaId = schema.id;
  }

  function removeSchema(id: string) {
    const idx = state.schemas.findIndex((s) => s.id === id);
    if (idx === -1) return;
    state.schemas.splice(idx, 1);
    if (state.activeSchemaId === id) {
      state.activeSchemaId = state.schemas[0]?.id ?? null;
    }
    // Clean up derivedFrom references
    for (const s of state.schemas) {
      if (s.derivedFrom === id) s.derivedFrom = undefined;
      // Clean up relations
      s.relations = s.relations.filter((r) => r.targetSchemaId !== id);
    }
  }

  function renameSchema(id: string, name: string) {
    const schema = state.schemas.find((s) => s.id === id);
    if (schema) schema.name = name;
  }

  function setActiveSchema(id: string | null) {
    state.activeSchemaId = id;
  }

  function setPopulateCount(id: string, count: number) {
    const schema = state.schemas.find((s) => s.id === id);
    if (schema) schema.populateCount = Math.max(0, count);
  }

  function setDerivedFrom(id: string, sourceId: string | undefined) {
    const schema = state.schemas.find((s) => s.id === id);
    if (schema) {
      schema.derivedFrom = sourceId;
      // When unsetting derivedFrom, clean up field source mappings
      if (!sourceId) {
        for (const f of schema.fields) f.sourceMapping = undefined;
      }
    }
  }

  function addSchemaRelation(id: string, targetSchemaId: string, name: string) {
    const schema = state.schemas.find((s) => s.id === id);
    if (schema) {
      schema.relations.push({ name, targetSchemaId });
    }
  }

  function removeSchemaRelation(id: string, relationName: string) {
    const schema = state.schemas.find((s) => s.id === id);
    if (schema) {
      schema.relations = schema.relations.filter((r) => r.name !== relationName);
      // Clean up field mappings for this relation
      for (const f of schema.fields) {
        if (f.relationMapping?.relationName === relationName) {
          f.relationMapping = undefined;
        }
      }
    }
  }

  // ── Fields ─────────────────────────────────────────────────────────────

  function addField(schemaId: string, parentId?: string) {
    const schema = state.schemas.find((s) => s.id === schemaId);
    if (!schema) return null;

    if (parentId) {
      const parent = findField(schema.fields, parentId);
      if (parent && parent.kind === "group") {
        const newField = makeField({ indent: parent.indent + 1 });
        parent.children.push(newField);
        return newField.id;
      }
    }

    const newField = makeField();
    schema.fields.push(newField);
    return newField.id;
  }

  function removeField(schemaId: string, fieldId: string) {
    const schema = state.schemas.find((s) => s.id === schemaId);
    if (!schema) return;

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
    recursiveRemove(schema.fields);
  }

  function updateField(schemaId: string, fieldId: string, patch: Partial<FieldDef>) {
    const schema = state.schemas.find((s) => s.id === schemaId);
    if (!schema) return;
    const field = findField(schema.fields, fieldId);
    if (!field) return;
    Object.assign(field, patch);

    if (patch.type) {
      const isGroup = patch.type === "object";
      field.kind = isGroup ? "group" : "field";
      if (isGroup && !field.children) {
        field.children = [];
      }
    }
  }

  function addModifier(schemaId: string, fieldId: string, modifier: ModifierDef) {
    const schema = state.schemas.find((s) => s.id === schemaId);
    if (!schema) return;
    const field = findField(schema.fields, fieldId);
    if (field) field.modifiers.push(modifier);
  }

  function removeModifier(schemaId: string, fieldId: string, modifierIndex: number) {
    const schema = state.schemas.find((s) => s.id === schemaId);
    if (!schema) return;
    const field = findField(schema.fields, fieldId);
    if (field) field.modifiers.splice(modifierIndex, 1);
  }

  function updateModifierValue(
    schemaId: string,
    fieldId: string,
    modifierIndex: number,
    value: string | number | boolean,
  ) {
    const schema = state.schemas.find((s) => s.id === schemaId);
    if (!schema) return;
    const field = findField(schema.fields, fieldId);
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

  // ── UI ─────────────────────────────────────────────────────────────────

  function setOutputTab(tab: "code" | "data" | "world") {
    state.ui.outputTab = tab;
  }

  function setExportOpen(open: boolean) {
    state.ui.exportOpen = open;
  }

  function setMobileTab(tab: "config" | "editor" | "output") {
    state.ui.activeMobileTab = tab;
  }

  // ── Derived helpers ────────────────────────────────────────────────────

  const activeSchema = $derived(state.schemas.find((s) => s.id === state.activeSchemaId) ?? null);

  const activeFields = $derived(activeSchema?.fields ?? []);

  const builderTitle = $derived(activeSchema?.name ?? "World Config");

  return {
    get state() {
      return state;
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

    setWorldSeed,
    setOptionalProbability,
    setDefaultArrayLength,
    fetchAvailableZodVersions,
    setZodVersion,

    addSchema,
    removeSchema,
    renameSchema,
    setActiveSchema,
    setPopulateCount,
    setDerivedFrom,
    addSchemaRelation,
    removeSchemaRelation,

    addField,
    removeField,
    updateField,
    addModifier,
    removeModifier,
    updateModifierValue,

    setOutputTab,
    setExportOpen,
    setMobileTab,
  };
}

export type PlaygroundStore = ReturnType<typeof createPlaygroundState>;
