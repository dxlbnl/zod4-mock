/**
 * codegen.ts
 * Pure functions — no Svelte, no runtime Zod imports.
 * Walks PlaygroundState and produces TypeScript source strings.
 */

import type { FieldDef, ModifierDef, PlaygroundState, SchemaDef } from "./state.svelte";

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
          .map((c) => `${pad}    ${c.key || "_"}: ${fieldToZodExpr(c, indent + 2)},`)
          .join("\n");
        base = `z.object({\n${childLines}\n${pad}  })`;
      }
      break;
    default:
      base = "z.unknown()";
  }

  const mods = field.modifiers.map(modifierToCode).join("");
  return `${base}${mods}`;
}

// ─── Schema → Code ────────────────────────────────────────────────────────────

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

  for (const schema of state.schemas) {
    const sOpts: string[] = [];

    if (schema.derivedFrom) {
      const src = state.schemas.find((s) => s.id === schema.derivedFrom);
      if (src) sOpts.push(`from: ${src.name}Schema`);
    }

    if (schema.relations.length > 0) {
      const rels = schema.relations
        .map((r) => {
          const target = state.schemas.find((s) => s.id === r.targetSchemaId);
          return `      ${r.name}: ${target?.name ?? "Unknown"}Schema`;
        })
        .join(",\n");
      sOpts.push(`relations: {\n${rels}\n    }`);
    }

    const matchers: string[] = [];
    for (const f of schema.fields) {
      if (schema.derivedFrom && f.sourceMapping) {
        matchers.push(`      ${f.key}: (ctx) => ctx.source.${f.sourceMapping}`);
      } else if (f.relationMapping) {
        matchers.push(
          `      ${f.key}: (ctx) => ctx.related("${f.relationMapping.relationName}").${f.relationMapping.targetFieldKey}`,
        );
      }
    }

    if (matchers.length > 0) {
      sOpts.push(`matchers: {\n${matchers.join(",\n")}\n    }`);
    }

    if (sOpts.length > 0) {
      lines.push(`  .withSchema(${schema.name}Schema, {\n    ${sOpts.join(",\n    ")}\n  })`);
    } else {
      lines.push(`  .withSchema(${schema.name}Schema)`);
    }
  }

  for (const schema of state.schemas) {
    if (schema.populateCount > 0) {
      lines.push(`  .populate(${schema.name}Schema, ${schema.populateCount})`);
    }
  }

  return lines.join("\n") + ";";
}

// ─── Full export file ─────────────────────────────────────────────────────────

export function generateFullExport(state: PlaygroundState): string {
  const parts: string[] = [];
  parts.push(`import { z } from "zod";`);
  parts.push(`import { createWorld } from "zod4-mock";\n`);

  parts.push(`// ── Schemas ──────────────────────────────────────────────────────────────`);
  for (const schema of state.schemas) {
    parts.push(generateSchemaCode(schema));
  }
  parts.push("");

  parts.push(`// ── World ────────────────────────────────────────────────────────────────`);
  parts.push(generateWorldCode(state));
  parts.push("");

  parts.push(`// ── Generate ─────────────────────────────────────────────────────────────`);
  for (const schema of state.schemas) {
    parts.push(`const ${lcFirst(schema.name)} = world.generate(${schema.name}Schema);`);
  }

  return parts.join("\n");
}

// ─── Tokenized code ───────────────────────────────────────────────────────────

export function generateTokenizedCode(schema: SchemaDef): CodeLine[] {
  const lines: CodeLine[] = [];
  let lineNum = 1;

  const pushLine = (tokens: CodeToken[], fieldId?: string) => {
    lines.push({ lineNumber: lineNum++, tokens, fieldId });
  };

  pushLine([
    kw("const "),
    pl(`${schema.name}Schema`),
    pt(" = "),
    ty("z"),
    pt("."),
    fn("object"),
    pt("({"),
  ]);

  for (const field of schema.fields) {
    const zodExpr = fieldToZodExpr(field, 1);
    const zodTokens = tokenizeZodExpr(zodExpr);
    pushLine([pl(`  ${field.key || "_"}`), pt(": "), ...zodTokens, pt(",")], field.id);
  }

  pushLine([pt("});")]);
  return lines;
}

// ─── Tokenize Helpers ────────────────────────────────────────────────────────

export function generateTokenizedData(data: unknown, fields: FieldDef[]): CodeLine[] {
  const lines: CodeLine[] = [];
  const json = JSON.stringify(data, null, 2);
  const jsonLines = json.split("\n");

  jsonLines.forEach((line, i) => {
    const tokens: CodeToken[] = [];
    let fieldId: string | undefined;

    const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
    if (keyMatch) {
      fieldId = findFieldIdByKey(fields, keyMatch[1]);
    }

    const parts = line.split(/(".*?"|[:,{}[\]]|\s+)/g).filter(Boolean);
    let hasFoundKey = false;
    for (const p of parts) {
      if (p.startsWith('"')) {
        if (!hasFoundKey && line.includes(`${p}:`)) {
          tokens.push(t("property", p));
          hasFoundKey = true;
        } else tokens.push(str(p));
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

function tokenizeZodExpr(expr: string): CodeToken[] {
  const tokens: CodeToken[] = [];
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
    if (p === "z") tokens.push(ty(p));
    else if ([".", "(", ")", ",", "[", "]"].includes(p)) tokens.push(pt(p));
    else if (/^\d+$/.test(p)) tokens.push(num(p));
    else if (/^[a-zA-Z]+$/.test(p)) tokens.push(fn(p));
    else tokens.push(pl(p));
  }
  return tokens;
}

export function generateTokenizedWorldData(data: Record<string, unknown[]>): CodeLine[] {
  const lines: CodeLine[] = [];
  const json = JSON.stringify(data, null, 2);
  const jsonLines = json.split("\n");

  jsonLines.forEach((line, i) => {
    const tokens: CodeToken[] = [];
    const parts = line.split(/(".*?"|[:,{}[\]]|\s+)/g).filter(Boolean);
    let hasFoundKey = false;
    for (const p of parts) {
      if (p.startsWith('"')) {
        if (!hasFoundKey && line.includes(`${p}:`)) {
          tokens.push(t("property", p));
          hasFoundKey = true;
        } else tokens.push(str(p));
      } else if (/^[\d.]+$/.test(p.trim())) tokens.push(num(p));
      else if (/^(true|false|null)$/.test(p.trim())) tokens.push(kw(p));
      else if (/^[:,{}[\]]$/.test(p.trim())) tokens.push(pt(p));
      else tokens.push(pl(p));
    }
    lines.push({ lineNumber: i + 1, tokens });
  });
  return lines;
}

function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function generateTokenizedFullExport(state: PlaygroundState): CodeLine[] {
  const code = generateFullExport(state);
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const tokens: CodeToken[] = [];
    if (line.trim().startsWith("//")) {
      tokens.push(t("comment", line));
      return { lineNumber: i + 1, tokens };
    }

    const parts = line.split(/(\s+|\.|\(|\)|"|'|,|\[|\]|;|{|}|:)/g).filter(Boolean);
    let inString = false;
    let quoteChar = "";

    for (let j = 0; j < parts.length; j++) {
      const p = parts[j];
      if (!inString && (p === '"' || p === "'")) {
        inString = true;
        quoteChar = p;
        tokens.push(pt(p));
        continue;
      }
      if (inString && p === quoteChar) {
        inString = false;
        tokens.push(pt(p));
        continue;
      }
      if (inString) {
        tokens.push(str(p));
        continue;
      }

      const trimmed = p.trim();
      if (!trimmed) {
        tokens.push(pl(p));
        continue;
      }

      if (/^(import|from|const|export|as|return|if|else|switch|case|break)$/.test(trimmed)) {
        tokens.push(kw(p));
      } else if (trimmed === "z") {
        tokens.push(ty(p));
      } else if (/^[A-Z][a-zA-Z0-9]+Schema$/.test(trimmed)) {
        tokens.push(ty(p));
      } else if (/^[A-Z][a-zA-Z0-9]+$/.test(trimmed)) {
        tokens.push(ty(p));
      } else if (/^[.(),[\];{}:]$/.test(trimmed)) {
        tokens.push(pt(p));
      } else if (/^\d+$/.test(trimmed)) {
        tokens.push(num(p));
      } else {
        // Look ahead to see if this is a property (followed by :)
        // or a function (preceded by .)
        const nextPart = parts[j + 1]?.trim();
        const prevPart = parts[j - 1]?.trim();

        if (nextPart === ":") {
          tokens.push(pr(p));
        } else if (prevPart === ".") {
          tokens.push(fn(p));
        } else {
          tokens.push(pl(p));
        }
      }
    }
    return { lineNumber: i + 1, tokens };
  });
}

export function exportLineCount(state: PlaygroundState): number {
  return generateFullExport(state).split("\n").length;
}
