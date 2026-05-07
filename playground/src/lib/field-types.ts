/**
 * field-types.ts
 * Static catalog of supported Zod field types and their available modifiers.
 * Drives the TypeChip dropdown and FloatingMenu items in the builder.
 */

export type ZodFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "uuid"
  | "email"
  | "url"
  | "enum"
  | "object"
  | "array"
  | "optional"
  | "nullable";

export interface ModifierSpec {
  /** The modifier name as it appears in code, e.g. ".min", ".int()" */
  name: string;
  /** Display label for the FloatingMenu */
  label: string;
  /** Short description for FloatingMenu */
  desc: string;
  /** Group heading in the FloatingMenu */
  category: "Constraints" | "Format" | "Wrappers";
  /** Whether this modifier takes a user-supplied value (e.g. ".min(18)") */
  hasValue: boolean;
  /** Default value when the modifier is first added */
  defaultValue?: string | number | boolean;
}

export interface FieldTypeSpec {
  /** Display label for the TypeChip */
  label: string;
  /** The Zod base expression used in codegen */
  zodExpr: string;
  /** Color hint for the TypeChip */
  color: "blue" | "green" | "purple" | "amber" | "slate" | "rose" | "teal" | "indigo";
  /** Available modifiers for this type */
  modifiers: ModifierSpec[];
}

export const FIELD_TYPES: Record<ZodFieldType, FieldTypeSpec> = {
  string: {
    label: "String",
    zodExpr: "z.string()",
    color: "blue",
    modifiers: [
      {
        name: ".min",
        label: "min length",
        desc: "minimum character count",
        category: "Constraints",
        hasValue: true,
        defaultValue: 1,
      },
      {
        name: ".max",
        label: "max length",
        desc: "maximum character count",
        category: "Constraints",
        hasValue: true,
        defaultValue: 255,
      },
      {
        name: ".length",
        label: "exact length",
        desc: "exact character count",
        category: "Constraints",
        hasValue: true,
        defaultValue: 8,
      },
      {
        name: ".startsWith",
        label: "startsWith",
        desc: "must start with string",
        category: "Constraints",
        hasValue: true,
        defaultValue: "",
      },
      {
        name: ".endsWith",
        label: "endsWith",
        desc: "must end with string",
        category: "Constraints",
        hasValue: true,
        defaultValue: "",
      },
      {
        name: ".toLowerCase()",
        label: "lowercase",
        desc: "transform to lowercase",
        category: "Format",
        hasValue: false,
      },
      {
        name: ".toUpperCase()",
        label: "uppercase",
        desc: "transform to uppercase",
        category: "Format",
        hasValue: false,
      },
      {
        name: ".trim()",
        label: "trim",
        desc: "strip whitespace",
        category: "Format",
        hasValue: false,
      },
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: "",
      },
    ],
  },

  number: {
    label: "Number",
    zodExpr: "z.number()",
    color: "green",
    modifiers: [
      {
        name: ".int()",
        label: "integer",
        desc: "whole numbers only",
        category: "Constraints",
        hasValue: false,
      },
      {
        name: ".min",
        label: "min",
        desc: "minimum value",
        category: "Constraints",
        hasValue: true,
        defaultValue: 0,
      },
      {
        name: ".max",
        label: "max",
        desc: "maximum value",
        category: "Constraints",
        hasValue: true,
        defaultValue: 100,
      },
      {
        name: ".multipleOf",
        label: "multipleOf",
        desc: "must be multiple of n",
        category: "Constraints",
        hasValue: true,
        defaultValue: 1,
      },
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: 0,
      },
    ],
  },

  boolean: {
    label: "Boolean",
    zodExpr: "z.boolean()",
    color: "purple",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: false,
      },
    ],
  },

  date: {
    label: "Date",
    zodExpr: "z.date()",
    color: "amber",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: "",
      },
    ],
  },

  uuid: {
    label: "UUID",
    zodExpr: "z.uuid()",
    color: "slate",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: "",
      },
    ],
  },

  email: {
    label: "Email",
    zodExpr: "z.email()",
    color: "teal",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: "",
      },
    ],
  },

  url: {
    label: "URL",
    zodExpr: "z.url()",
    color: "teal",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: "",
      },
    ],
  },

  enum: {
    label: "Enum",
    zodExpr: "z.enum([...])",
    color: "rose",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".default",
        label: "default",
        desc: "fallback enum value",
        category: "Wrappers",
        hasValue: true,
        defaultValue: "",
      },
    ],
  },

  object: {
    label: "Object",
    zodExpr: "z.object({})",
    color: "indigo",
    modifiers: [
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
    ],
  },

  array: {
    label: "Array",
    zodExpr: "z.array(...)",
    color: "indigo",
    modifiers: [
      {
        name: ".min",
        label: "min items",
        desc: "minimum array length",
        category: "Constraints",
        hasValue: true,
        defaultValue: 1,
      },
      {
        name: ".max",
        label: "max items",
        desc: "maximum array length",
        category: "Constraints",
        hasValue: true,
        defaultValue: 5,
      },
      {
        name: ".length",
        label: "exact length",
        desc: "exact array length",
        category: "Constraints",
        hasValue: true,
        defaultValue: 3,
      },
      {
        name: ".optional()",
        label: "optional",
        desc: "field may be undefined",
        category: "Wrappers",
        hasValue: false,
      },
      {
        name: ".nullable()",
        label: "nullable",
        desc: "field may be null",
        category: "Wrappers",
        hasValue: false,
      },
    ],
  },

  optional: {
    label: "Optional",
    zodExpr: "z.optional(...)",
    color: "slate",
    modifiers: [],
  },

  nullable: {
    label: "Nullable",
    zodExpr: "z.nullable(...)",
    color: "slate",
    modifiers: [],
  },
};

/** All types that can appear as a root field (excludes wrapper-only types) */
export const SELECTABLE_FIELD_TYPES: ZodFieldType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "uuid",
  "email",
  "url",
  "enum",
  "object",
  "array",
];

/** Returns the modifier specs available for a given field type */
export function getModifiers(type: ZodFieldType): ModifierSpec[] {
  return FIELD_TYPES[type]?.modifiers ?? [];
}

/** Returns FloatingMenu items for a given type */
export function getMenuItems(type: ZodFieldType) {
  return getModifiers(type).map((m) => ({
    name: m.name,
    desc: m.desc,
    category: m.category,
  }));
}
