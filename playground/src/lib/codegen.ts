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
  /** Indentation depth for folding */
  depth?: number;
  /** Whether this line can be folded (starts a block) */
  isFoldable?: boolean;
}

/**
 * Orchestrates token generation and line tracking.
 */
export class TokenEmitter implements Emitter {
  private lines: CodeLine[] = [];
  private currentTokens: CodeToken[] = [];
  private currentFieldId?: string;
  private lineNum = 1;
  private depth = 0;

  emit(kind: TokenKind, text: string, fieldId?: string) {
    this.currentTokens.push({ kind, text });
    if (fieldId) this.currentFieldId = fieldId;
    return this;
  }

  newline() {
    // Detect folding
    const lastToken = this.currentTokens[this.currentTokens.length - 1]?.text.trim();
    const isFoldableHeuristic = lastToken?.endsWith("{") || lastToken?.endsWith("[");

    this.lines.push({
      lineNumber: this.lineNum++,
      tokens: [...this.currentTokens],
      fieldId: this.currentFieldId,
      depth: this.depth,
      isFoldable: isFoldableHeuristic,
    });

    if (isFoldableHeuristic) this.depth++;

    this.currentTokens = [];
    this.currentFieldId = undefined;
    return this;
  }

  /** Finalizes the last line if not empty and returns all lines. */
  finish(): CodeLine[] {
    if (this.currentTokens.length > 0) this.newline();

    // Pass 1: Fix depths (decrement on closing lines)
    let d = 0;
    const withDepths = this.lines.map((line) => {
      const text = line.tokens
        .map((t) => t.text)
        .join("")
        .trim();

      // If line starts with a closer, it belongs to the outer depth
      if (
        text.startsWith("}") ||
        text.startsWith("]") ||
        text.startsWith("})") ||
        text.startsWith("];")
      ) {
        d = Math.max(0, d - 1);
      }

      const updatedLine = { ...line, depth: d };

      // If line was marked foldable (opened a block), increment for next lines
      if (line.isFoldable) d++;

      return updatedLine;
    });

    // Pass 2: Refine isFoldable (any line followed by a deeper line is foldable)
    return withDepths.map((line, i) => {
      const next = withDepths[i + 1];
      const isFoldable = (next && next.depth > line.depth) || line.isFoldable;
      return { ...line, isFoldable };
    });
  }

  /** Emits a TypeScript fragment by tokenizing it into semantic tokens. */
  emitTS(code: string): this {
    const parts = code.split(/(\s+|\.|\(|\)|"|'|,|\[|\]|;|{|}|:)/g).filter(Boolean);
    let inString = false;
    let quoteChar = "";

    for (let j = 0; j < parts.length; j++) {
      const p = parts[j];
      if (!inString && (p === '"' || p === "'")) {
        inString = true;
        quoteChar = p;
        this.emit("punct", p);
        continue;
      }
      if (inString && p === quoteChar) {
        inString = false;
        this.emit("punct", p);
        continue;
      }
      if (inString) {
        this.emit("string", p);
        continue;
      }

      const trimmed = p.trim();
      if (!trimmed) {
        this.emit("plain", p);
        continue;
      }

      if (/^(import|from|const|export|as|return|if|else|switch|case|break)$/.test(trimmed)) {
        this.emit("keyword", p);
      } else if (trimmed === "z") {
        this.emit("type", p);
      } else if (/^[A-Z][a-zA-Z0-9]+Schema$/.test(trimmed)) {
        this.emit("type", p);
      } else if (/^[A-Z][a-zA-Z0-9]+$/.test(trimmed)) {
        this.emit("type", p);
      } else if (/^[.(),[\];{}:]$/.test(trimmed)) {
        this.emit("punct", p);
      } else if (/^\d+$/.test(trimmed)) {
        this.emit("number", p);
      } else {
        // Find next/prev non-whitespace part for context
        let nextPart = "";
        for (let k = j + 1; k < parts.length; k++) {
          if (parts[k].trim()) {
            nextPart = parts[k].trim();
            break;
          }
        }
        let prevPart = "";
        for (let k = j - 1; k >= 0; k--) {
          if (parts[k].trim()) {
            prevPart = parts[k].trim();
            break;
          }
        }

        if (nextPart === ":") this.emit("property", p);
        else if (prevPart === ".") this.emit("fn", p);
        else this.emit("plain", p);
      }
    }
    return this;
  }
}

/**
 * Unified interface for generating either tokens or raw strings.
 */
export interface Emitter {
  emit(kind: TokenKind, text: string, id?: string): this;
  newline(): this;
  /** Emits a TypeScript fragment with automatic tokenization (if supported by the emitter). */
  emitTS(code: string): this;
}

export class StringEmitter implements Emitter {
  private parts: string[] = [];
  emit(_kind: TokenKind, text: string) {
    this.parts.push(text);
    return this;
  }
  newline() {
    this.parts.push("\n");
    return this;
  }
  emitTS(code: string) {
    this.parts.push(code);
    return this;
  }
  toString() {
    return this.parts.join("");
  }
}

// ─── Modifier codegen ─────────────────────────────────────────────────────────

function emitModifier(mod: ModifierDef, e: Emitter) {
  const name = mod.name.replace(/^\./, "").replace(/\(\)$/, "");
  e.emit("punct", ".").emit("fn", name);

  if (mod.value !== undefined) {
    e.emit("punct", "(");
    if (typeof mod.value === "string") {
      e.emit("string", `"${mod.value}"`);
    } else {
      e.emit("number", String(mod.value));
    }
    e.emit("punct", ")");
  } else {
    e.emit("punct", "()");
  }
}

// ─── Field → Zod expression ───────────────────────────────────────────────────

function emitField(field: FieldDef, indent = 0, e: Emitter) {
  const pad = "  ".repeat(indent);
  if (pad) e.emit("plain", pad);

  e.emit("type", "z").emit("punct", ".");

  switch (field.type) {
    case "string":
      e.emit("fn", "string").emit("punct", "()");
      break;
    case "number":
      e.emit("fn", "number").emit("punct", "()");
      break;
    case "boolean":
      e.emit("fn", "boolean").emit("punct", "()");
      break;
    case "date":
      e.emit("fn", "date").emit("punct", "()");
      break;
    case "uuid":
      e.emit("fn", "uuid").emit("punct", "()");
      break;
    case "email":
      e.emit("fn", "email").emit("punct", "()");
      break;
    case "url":
      e.emit("fn", "url").emit("punct", "()");
      break;
    case "enum":
      e.emit("fn", "enum").emit("punct", "([");
      if (field.enumValues.length > 0) {
        field.enumValues.forEach((v, i) => {
          e.emit("string", `"${v}"`);
          if (i < field.enumValues.length - 1) e.emit("punct", ", ");
        });
      }
      e.emit("punct", "])");
      break;
    case "object":
      e.emit("fn", "object").emit("punct", "({");
      if (field.children.length > 0) {
        e.newline();
        field.children.forEach((c) => {
          e.emit("plain", "  ".repeat(indent + 1))
            .emit("property", c.key || "_", c.id)
            .emit("punct", ": ");
          emitField(c, 0, e);
          e.emit("punct", ",").newline();
        });
        e.emit("plain", pad).emit("punct", "})");
      } else {
        e.emit("punct", "})");
      }
      break;
    default:
      e.emit("fn", "unknown").emit("punct", "()");
  }

  field.modifiers.forEach((mod) => emitModifier(mod, e));
}

// ─── Schema → Code ────────────────────────────────────────────────────────────

export function generateSchemaCode(schema: SchemaDef, e: Emitter = new StringEmitter()): string {
  e.emit("keyword", "const ").emitTS(`${schema.name}Schema`).emit("punct", " = ");
  emitField(
    {
      type: "object",
      children: schema.fields,
      modifiers: [],
      key: "",
      id: "",
      kind: "group",
      indent: 0,
      enumValues: [],
    },
    0,
    e,
  );
  e.emit("punct", ";");

  return e instanceof StringEmitter ? e.toString() : "";
}

// ─── World setup code ─────────────────────────────────────────────────────────

export function generateWorldCode(
  state: PlaygroundState,
  e: Emitter = new StringEmitter(),
): string {
  const opts: string[] = [`seed: ${state.world.seed}`];
  if (state.world.optionalProbability !== 0.2) {
    opts.push(`optionalProbability: ${state.world.optionalProbability}`);
  }
  if (state.world.defaultArrayLengthMin !== 1 || state.world.defaultArrayLengthMax !== 5) {
    opts.push(
      `defaultArrayLength: [${state.world.defaultArrayLengthMin}, ${state.world.defaultArrayLengthMax}]`,
    );
  }

  e.emit("keyword", "const ")
    .emitTS("world")
    .emit("punct", " = ")
    .emit("fn", "createWorld")
    .emit("punct", "({ ")
    .emitTS(opts.join(", "))
    .emit("punct", " })")
    .newline();

  for (const schema of state.schemas) {
    e.emit("plain", "  ")
      .emit("punct", ".")
      .emit("fn", "withSchema")
      .emit("punct", "(")
      .emitTS(`${schema.name}Schema`);

    const sOpts: string[] = [];
    if (schema.derivedFrom) {
      const src = state.schemas.find((s) => s.id === schema.derivedFrom);
      if (src) sOpts.push(`from: ${src.name}Schema`);
    }

    if (schema.relations.length > 0) {
      const rels = schema.relations
        .map((r) => {
          const target = state.schemas.find((s) => s.id === r.targetSchemaId);
          return `${r.name}: ${target?.name ?? "Unknown"}Schema`;
        })
        .join(",\n      ");
      sOpts.push(`relations: {\n      ${rels}\n    }`);
    }

    const matchers: string[] = [];
    for (const f of schema.fields) {
      if (schema.derivedFrom && f.sourceMapping) {
        matchers.push(`${f.key}: (ctx) => ctx.source.${f.sourceMapping}`);
      } else if (f.relationMapping) {
        matchers.push(
          `${f.key}: (ctx) => ctx.related("${f.relationMapping.relationName}").${f.relationMapping.targetFieldKey}`,
        );
      }
    }

    if (matchers.length > 0) {
      sOpts.push(`matchers: {\n      ${matchers.join(",\n      ")}\n    }`);
    }

    if (sOpts.length > 0) {
      e.emit("punct", ", {")
        .newline()
        .emitTS(`    ${sOpts.join(",\n    ")}`)
        .newline()
        .emit("plain", "  ")
        .emit("punct", ")");
    } else {
      e.emit("punct", ")");
    }
    e.newline();
  }

  for (const schema of state.schemas) {
    if (schema.populateCount > 0) {
      e.emit("plain", "  ")
        .emit("punct", ".")
        .emit("fn", "populate")
        .emit("punct", "(")
        .emitTS(`${schema.name}Schema`)
        .emit("punct", ", ")
        .emit("number", String(schema.populateCount))
        .emit("punct", ")")
        .newline();
    }
  }

  e.emit("punct", ";");
  return e instanceof StringEmitter ? e.toString() : "";
}

// ─── Full export file ─────────────────────────────────────────────────────────

export function generateFullExport(
  state: PlaygroundState,
  e: Emitter = new StringEmitter(),
): string {
  e.emit("keyword", "import ")
    .emit("punct", "{ ")
    .emitTS("z")
    .emit("punct", " } ")
    .emit("keyword", "from ")
    .emit("string", '"zod"')
    .emit("punct", ";")
    .newline();
  e.emit("keyword", "import ")
    .emit("punct", "{ ")
    .emitTS("createWorld")
    .emit("punct", " } ")
    .emit("keyword", "from ")
    .emit("string", '"zod4-mock"')
    .emit("punct", ";")
    .newline()
    .newline();

  e.emit(
    "comment",
    "// ── Schemas ──────────────────────────────────────────────────────────────",
  ).newline();
  for (const schema of state.schemas) {
    generateSchemaCode(schema, e);
    e.newline();
  }
  e.newline();

  e.emit(
    "comment",
    "// ── World ────────────────────────────────────────────────────────────────",
  ).newline();
  generateWorldCode(state, e);
  e.newline().newline();

  e.emit(
    "comment",
    "// ── Generate ─────────────────────────────────────────────────────────────",
  ).newline();
  for (const schema of state.schemas) {
    e.emit("keyword", "const ")
      .emitTS(lcFirst(schema.name))
      .emit("punct", " = ")
      .emitTS("world")
      .emit("punct", ".")
      .emit("fn", "generate")
      .emit("punct", "(")
      .emitTS(`${schema.name}Schema`)
      .emit("punct", ");")
      .newline();
  }

  return e instanceof StringEmitter ? e.toString() : "";
}

// ─── Tokenized code ───────────────────────────────────────────────────────────

export function generateTokenizedCode(schema: SchemaDef): CodeLine[] {
  const e = new TokenEmitter();
  generateSchemaCode(schema, e);
  return e.finish();
}

// ─── Tokenize Helpers ────────────────────────────────────────────────────────

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

/**
 * Common JSON tokenizer for mock data and world data previews.
 */
export function generateTokenizedJSON(data: unknown, fields?: FieldDef[]): CodeLine[] {
  const e = new TokenEmitter();
  const json = JSON.stringify(data, null, 2);
  const lines = json.split("\n");

  lines.forEach((line) => {
    let hasFoundKey = false;
    let fieldId: string | undefined;

    if (fields) {
      const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
      if (keyMatch) fieldId = findFieldIdByKey(fields, keyMatch[1]);
    }

    const parts = line.split(/(".*?"|[:,{}[\]]|\s+)/g).filter(Boolean);
    for (const p of parts) {
      const trimmed = p.trim();
      if (p.startsWith('"')) {
        if (!hasFoundKey && line.includes(`${p}:`)) {
          e.emit("property", p, fieldId);
          hasFoundKey = true;
        } else e.emit("string", p);
      } else if (/^[\d.]+$/.test(trimmed)) {
        e.emit("number", p);
      } else if (/^(true|false|null)$/.test(trimmed)) {
        e.emit("keyword", p);
      } else if (/^[:,{}[\]]$/.test(trimmed)) {
        e.emit("punct", p);
      } else {
        e.emit("plain", p);
      }
    }
    e.newline();
  });

  return e.finish();
}

/** Legacy aliases for backward compatibility */
export const generateTokenizedData = generateTokenizedJSON;
export const generateTokenizedWorldData = (data: Record<string, unknown[]>) =>
  generateTokenizedJSON(data);

export function generateTokenizedFullExport(state: PlaygroundState): CodeLine[] {
  const e = new TokenEmitter();
  generateFullExport(state, e);
  return e.finish();
}

export function exportLineCount(state: PlaygroundState): number {
  return generateFullExport(state).split("\n").length;
}

function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
