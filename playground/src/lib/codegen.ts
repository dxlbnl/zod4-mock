/**
 * codegen.ts
 * Pure functions — no Svelte, no runtime Zod imports.
 * Walks PlaygroundState and produces TypeScript source strings.
 */

import type { FieldDef, ModifierDef, PlaygroundState, RelationshipDef, SchemaDef, SubjectDef } from "./state.svelte";

// ─── Token types for syntax highlighting ─────────────────────────────────────

export type TokenKind =
  | "keyword"
  | "type"
  | "fn"
  | "string"
  | "number"
  | "comment"
  | "punct"
  | "property"
  | "plain";

export interface CodeToken {
  kind: TokenKind;
  text: string;
}

export interface CodeLine {
  /** 1-based line number */
  lineNumber: number;
  tokens: CodeToken[];
  /** The field ID this line corresponds to (for active-line tracking) */
  fieldId?: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

const t = (kind: TokenKind, text: string): CodeToken => ({ kind, text });
const kw = (text: string) => t("keyword", text);
const ty = (text: string) => t("type", text);
const fn = (text: string) => t("fn", text);
const str = (text: string) => t("string", text);
const num = (text: string) => t("number", text);
const pt = (text: string) => t("punct", text);
const pl = (text: string) => t("plain", text);
const pr = (text: string) => t("property", text);

// ─── Modifier codegen ─────────────────────────────────────────────────────────

function modifierToCode(mod: ModifierDef): string {
  if (mod.value !== undefined) {
    let val: string;
    if (typeof mod.value === "string") {
      val = `"${mod.value}"`;
    } else {
      val = String(mod.value);
    }
    const base = mod.name.replace(/\(\)$/, "");
    return `${base}(${val})`;
  }
  // Already has parens (e.g. ".int()")
  return mod.name.endsWith("()") ? mod.name : `${mod.name}()`;
}

// ─── Field → Zod expression ───────────────────────────────────────────────────

function fieldToZodExpr(field: FieldDef, indent = 0): string {
  const pad = "  ".repeat(indent);
  let base: string;

  switch (field.type) {
    case "string":
      base = "z.string()";
      break;
    case "number":
      base = "z.number()";
      break;
    case "boolean":
      base = "z.boolean()";
      break;
    case "date":
      base = "z.date()";
      break;
    case "uuid":
      base = "z.uuid()";
      break;
    case "email":
      base = "z.email()";
      break;
    case "url":
      base = "z.url()";
      break;
    case "enum":
      if (field.enumValues.length === 0) {
        base = "z.enum([])";
      } else {
        const vals = field.enumValues.map((v) => `"${v}"`).join(", ");
        base = `z.enum([${vals}])`;
      }
      break;
    case "object":
      if (field.children.length === 0) {
        base = "z.object({})";
      } else {
        const childLines = field.children
          .map((c) => `${pad}    ${c.key}: ${fieldToZodExpr(c, indent + 2)},`)
          .join("\n");
        base = `z.object({\n${childLines}\n${pad}  })`;
      }
      break;
    case "array":
      base = "z.array(z.unknown())"; // placeholder — array item type TBD
      break;
    default:
      base = "z.unknown()";
  }

  const mods = field.modifiers.map(modifierToCode).join("");
  return `${base}${mods}`;
}

// ─── Subject → defineSubjectType code ─────────────────────────────────────────

export function generateSubjectCode(
  subject: SubjectDef,
  relationships: RelationshipDef[] = [],
): string {
  const rels = relationships.filter((r) => r.from === subject.name);

  let fieldsStr = "z.object({})";
  if (subject.fields.length > 0) {
    const fields = subject.fields
      .map((f) => `  ${f.key || "_"}: ${fieldToZodExpr(f, 1)},`)
      .join("\n");
    fieldsStr = `z.object({\n${fields}\n})`;
  }

  if (rels.length === 0) {
    return `const ${subject.name}Subject = defineSubjectType("${subject.name}", ${fieldsStr});`;
  }

  const relLines = rels
    .map((r) => `    ${r.relationName}: { to: "${r.to}", cardinality: "${r.cardinality}" },`)
    .join("\n");

  return (
    `const ${subject.name}Subject = defineSubjectType("${subject.name}", ${fieldsStr}, {\n` +
    `  relations: {\n` +
    `${relLines}\n` +
    `  }\n` +
    `});`
  );
}

// ─── Schema → const declaration ───────────────────────────────────────────────

export function generateSchemaCode(schema: SchemaDef): string {
  if (schema.fields.length === 0) {
    return `const ${schema.name}Schema = z.object({});`;
  }
  const fields = schema.fields.map((f) => `  ${f.key || "_"}: ${fieldToZodExpr(f, 1)},`).join("\n");
  return `const ${schema.name}Schema = z.object({\n${fields}\n});`;
}

// ─── World setup code ─────────────────────────────────────────────────────────

export function generateWorldCode(state: PlaygroundState): string {
  const lines: string[] = [];

  // createWorld options
  const opts: string[] = [`seed: ${state.world.seed}`];
  if (state.world.optionalProbability !== 0.2) {
    opts.push(`optionalProbability: ${state.world.optionalProbability}`);
  }
  if (state.world.defaultArrayLengthMin !== 1 || state.world.defaultArrayLengthMax !== 5) {
    opts.push(
      `defaultArrayLength: [${state.world.defaultArrayLengthMin}, ${state.world.defaultArrayLengthMax}]`,
    );
  }

  lines.push(`const world = createWorld({ ${opts.join(", ")} })`);

  // withSubject
  for (const subj of state.subjects) {
    lines.push(`  .withSubject(${subj.name}Subject)`);
  }

  // withSchema
  for (const schema of state.schemas) {
    const binding = state.bindings.find((b) => b.schemaId === schema.id);
    if (!binding) continue;
    const subj = state.subjects.find((s) => s.id === binding.subjectId);
    if (!subj) continue;

    const matchers = Object.entries(binding.fieldMap)
      .map(([schemaKey, subjectKey]) => `    ${schemaKey}: (s) => s.${subjectKey},`)
      .join("\n");

    if (matchers) {
      lines.push(`  .withSchema(${schema.name}Schema, ${subj.name}Subject, {\n${matchers}\n  })`);
    } else {
      lines.push(`  .withSchema(${schema.name}Schema, ${subj.name}Subject)`);
    }
  }

  // populate
  for (const subj of state.subjects) {
    if (subj.count > 0) {
      lines.push(`  .populate(${subj.name}Subject, ${subj.count})`);
    }
  }

  return lines.join("\n") + ";";
}

// ─── Full export file ─────────────────────────────────────────────────────────

export function generateFullExport(state: PlaygroundState): string {
  const parts: string[] = [];

  // Imports
  parts.push(`import { z } from "zod";`);
  parts.push(`import { createWorld, defineSubjectType } from "zod4-mock";\n`);

  // Subject schemas
  if (state.subjects.length > 0) {
    parts.push(`// ── Subjects ─────────────────────────────────────────────────────────────`);
    for (const subj of state.subjects) {
      parts.push(generateSubjectCode(subj, state.relationships));
    }
    parts.push("");
  }

  // API Schemas
  if (state.schemas.length > 0) {
    parts.push(`// ── Schemas ──────────────────────────────────────────────────────────────`);
    for (const schema of state.schemas) {
      parts.push(generateSchemaCode(schema));
    }
    parts.push("");
  }

  // World
  parts.push(`// ── World ────────────────────────────────────────────────────────────────`);
  parts.push(generateWorldCode(state));
  parts.push("");

  // Generation calls
  parts.push(`// ── Generate ─────────────────────────────────────────────────────────────`);
  for (const schema of state.schemas) {
    parts.push(`const ${lcFirst(schema.name)} = world.generate(z.array(${schema.name}Schema));`);
  }
  for (const subj of state.subjects) {
    parts.push(`const ${lcFirst(subj.name)}s = world.generate(z.array(z.object({})));`);
  }

  return parts.join("\n");
}

// ─── Tokenized code (for CodeView syntax highlighting) ───────────────────────

export function generateTokenizedCode(
  subject: SubjectDef,
  relationships: RelationshipDef[] = [],
): CodeLine[] {
  const lines: CodeLine[] = [];
  let lineNum = 1;

  function pushLine(tokens: CodeToken[], fieldId?: string) {
    lines.push({ lineNumber: lineNum++, tokens, fieldId });
  }

  const rels = relationships.filter((r) => r.from === subject.name);

  // const UserSubject = defineSubjectType("User", z.object({
  pushLine([
    kw("const "),
    pl(`${subject.name}Subject`),
    pt(" = "),
    fn("defineSubjectType"),
    pt("("),
    pt('"'),
    str(subject.name),
    pt('"'),
    pt(", "),
    ty("z"),
    pt("."),
    fn("object"),
    pt("({"),
  ]);

  for (const field of subject.fields) {
    const zodExpr = fieldToZodExpr(field, 1);
    const zodTokens = tokenizeZodExpr(zodExpr);
    pushLine([pl(`  ${field.key || "_"}`), pt(": "), ...zodTokens, pt(",")], field.id);
  }

  if (rels.length === 0) {
    pushLine([pt("}));")]);
  } else {
    pushLine([pt("}), {")]);
    pushLine([pl("  "), pr("relations"), pt(": {")]);
    for (const r of rels) {
      pushLine([
        pl(`    ${r.relationName}`),
        pt(": { "),
        pr("to"),
        pt(': "'),
        str(r.to),
        pt('", '),
        pr("cardinality"),
        pt(': "'),
        str(r.cardinality),
        pt('" },'),
      ]);
    }
    pushLine([pl("  }"), pt(" });")]);
  }

  return lines;
}

/** Tokenize a JSON string with field correlation */
export function generateTokenizedData(data: unknown, fields: FieldDef[]): CodeLine[] {
  const lines: CodeLine[] = [];
  // Pretty print the JSON and then use regex to find keys and match them to fields
  const json = JSON.stringify(data, null, 2);
  const jsonLines = json.split("\n");

  jsonLines.forEach((line, i) => {
    const tokens: CodeToken[] = [];
    let fieldId: string | undefined;

    // Regex to find "key":
    const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
    if (keyMatch) {
      const key = keyMatch[1];
      // Find field ID by key name (this is a heuristic, might be ambiguous for nested)
      // A better way would be to track paths
      fieldId = findFieldIdByKey(fields, key);
    }

    // Basic JSON line tokenizer
    const parts = line.split(/(".*?"|[:,{}[\]]|\s+)/g).filter(Boolean);
    let hasFoundKey = false;
    for (const p of parts) {
      if (p.startsWith('"')) {
        if (!hasFoundKey && line.includes(`${p}:`)) {
          tokens.push(t("property", p));
          hasFoundKey = true;
        } else {
          tokens.push(str(p));
        }
      } else if (/^[\d.]+$/.test(p.trim())) tokens.push(num(p));
      else if (/^(true|false|null)$/.test(p.trim())) tokens.push(kw(p));
      else if (/^[:,{}[\]]$/.test(p.trim())) tokens.push(pt(p));
      else tokens.push(pl(p));
    }

    lines.push({ lineNumber: i + 1, tokens, fieldId });
  });

  return lines;
}

function findFieldIdByKey(fields: FieldDef[], key: string): string | undefined {
  for (const f of fields) {
    if (f.key === key) return f.id;
    if (f.children) {
      const found = findFieldIdByKey(f.children, key);
      if (found) return found;
    }
  }
  return undefined;
}

/** Lightweight tokenizer for Zod expression chains (e.g. "z.string().min(5)") */
function tokenizeZodExpr(expr: string): CodeToken[] {
  const tokens: CodeToken[] = [];

  // Split by boundary points but keep them
  // We look for: . ( ) "..." 0-9
  const parts = expr.split(/(\.|\(|\)|"|'|,|\[|\])/g).filter(Boolean);

  let inString = false;

  for (const p of parts) {
    if (p === '"' || p === "'") {
      inString = !inString;
      tokens.push(pt(p));
      continue;
    }

    if (inString) {
      tokens.push(str(p));
      continue;
    }

    if (p === "z") {
      tokens.push(ty(p));
    } else if (p === "." || p === "(" || p === ")" || p === "," || p === "[" || p === "]") {
      tokens.push(pt(p));
    } else if (/^\d+$/.test(p)) {
      tokens.push(num(p));
    } else if (/^[a-zA-Z]+$/.test(p)) {
      // If it's followed by ( in the original string, it's a function
      // But since we split, we just assume words in Zod chain are functions
      tokens.push(fn(p));
    } else {
      tokens.push(pl(p));
    }
  }

  return tokens;
}

/** Tokenize a World data record (SubjectName -> Instances) */
export function generateTokenizedWorldData(data: Record<string, unknown[]>): CodeLine[] {
  const lines: CodeLine[] = [];
  const json = JSON.stringify(data, null, 2);
  const jsonLines = json.split("\n");

  jsonLines.forEach((line, i) => {
    const tokens: CodeToken[] = [];

    // Basic JSON line tokenizer (same as generateTokenizedData but no fieldId matching for now)
    const parts = line.split(/(".*?"|[:,{}[\]]|\s+)/g).filter(Boolean);
    let hasFoundKey = false;
    for (const p of parts) {
      if (p.startsWith('"')) {
        if (!hasFoundKey && line.includes(`${p}:`)) {
          tokens.push(t("property", p));
          hasFoundKey = true;
        } else {
          tokens.push(str(p));
        }
      } else if (/^[\d.]+$/.test(p.trim())) tokens.push(num(p));
      else if (/^(true|false|null)$/.test(p.trim())) tokens.push(kw(p));
      else if (/^[:,{}[\]]$/.test(p.trim())) tokens.push(pt(p));
      else tokens.push(pl(p));
    }

    lines.push({ lineNumber: i + 1, tokens });
  });

  return lines;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Count total lines in the full export */
export function exportLineCount(state: PlaygroundState): number {
  return generateFullExport(state).split("\n").length;
}
