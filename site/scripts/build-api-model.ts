/**
 * B125 — TypeDoc → in-site API model.
 *
 * Build-time only (D13-exempt: uses node:* + reads the TypeDoc JSON). Transforms
 * the TypeDoc JSON model (`src/lib/docs/api/typedoc.json`, emitted by `typedoc`)
 * into a small, plain, runtime-agnostic render model written to
 * `src/lib/docs/api/api-model.generated.ts`. The `/docs/api` `+page.svelte` imports
 * that module and renders it; the dangling-link guard validates its cross-links.
 *
 * The render model is member-level: functions carry their signature + parameters and,
 * where a parameter is an option/config type, an expanded options table; option/config
 * types carry every field (name/type/optional/description); interfaces carry every
 * method (signature + description + a resolvable member anchor). Cross-links to other
 * documented symbols carry the target anchor so they resolve in-page.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { createHighlighter } from "shiki";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(here, "..");
const JSON_PATH = join(siteRoot, "src", "lib", "docs", "api", "typedoc.json");
const OUT_PATH = join(siteRoot, "src", "lib", "docs", "api", "api-model.generated.ts");

// ── TypeDoc JSON shapes (only the parts we consume) ──────────────────────────

type CommentPart = { kind: string; text?: string; tag?: string; target?: number | string };
interface Comment {
  summary?: CommentPart[];
  blockTags?: { tag: string; content: CommentPart[] }[];
}
interface Source {
  fileName: string;
  line: number;
}
interface Flags {
  isOptional?: boolean;
}
// A TypeDoc type node — recursive; only the fields the renderer reads are typed.
interface TypeNode {
  type: string;
  name?: string;
  package?: string;
  target?: number | { packageName?: string; qualifiedName?: string };
  typeArguments?: TypeNode[];
  elements?: TypeNode[];
  types?: TypeNode[];
  operator?: string;
  value?: unknown;
  declaration?: ReflNode;
  elementType?: TypeNode;
  refersToTypeParameter?: boolean;
}
interface ParamNode {
  name: string;
  flags?: Flags;
  comment?: Comment;
  type?: TypeNode;
}
interface SignatureNode {
  name: string;
  comment?: Comment;
  parameters?: ParamNode[];
  type?: TypeNode;
  typeParameters?: { name: string }[];
}
interface ReflNode {
  id?: number;
  name: string;
  kind: number;
  flags?: Flags;
  comment?: Comment;
  sources?: Source[];
  children?: ReflNode[];
  signatures?: SignatureNode[];
  type?: TypeNode;
  /**
   * Set by TypeDoc on a member flattened into a child interface from a base it
   * `extends`. `name` is the qualified base member (e.g. `GenerationDefaults.seed`).
   */
  inheritedFrom?: { type: string; name?: string; target?: number | string };
}
interface Project {
  children?: ReflNode[];
}

// TypeDoc ReflectionKind values we branch on.
const KIND = {
  Function: 64,
  Interface: 256,
  TypeAlias: 2097152,
  Property: 1024,
  Method: 2048,
  Variable: 32,
} as const;

// ── render-model output shapes (mirrored in the generated module) ────────────

interface Ref {
  text: string;
  /** Anchor id of a documented symbol on this page, or null for an external type. */
  anchor: string | null;
}
interface FieldRow {
  name: string;
  type: Ref[];
  optional: boolean;
  description: string;
}
interface ParamRow {
  name: string;
  type: Ref[];
  optional: boolean;
  description: string;
  /** When the param's type is a documented option/config object, its expanded fields. */
  expanded?: FieldRow[];
}
interface MethodEntry {
  name: string;
  anchor: string;
  signature: string;
  /** Shiki-highlighted HTML of `signature` (dual themes github-light/github-dark-dimmed, lang ts). */
  signatureHtml: string;
  description: string;
}
/** A field inherited from a base type, linked to that base's member entry. */
interface InheritedRef {
  name: string;
  /** Member anchor on the base type's entry (e.g. `GenerationDefaults.seed`). */
  anchor: string;
}
/** A group of inherited fields, keyed by the base type they come from. */
interface InheritedGroup {
  from: string;
  /** Anchor of the base type's own entry on the page. */
  fromAnchor: string | null;
  fields: InheritedRef[];
}
interface ApiSymbol {
  name: string;
  anchor: string;
  kind: "function" | "interface" | "type" | "value";
  signature: string;
  /** Shiki-highlighted HTML of `signature` (dual themes github-light/github-dark-dimmed, lang ts). */
  signatureHtml: string;
  description: string;
  examples: string[];
  /** Shiki-highlighted HTML of each `examples` entry (dual themes github-light/github-dark-dimmed, lang ts). */
  examplesHtml: string[];
  params?: ParamRow[];
  fields?: FieldRow[];
  /** Fields inherited from base types (rendered as a compact link row, not re-described). */
  inherited?: InheritedGroup[];
  methods?: MethodEntry[];
  /** Cross-reference links found in this symbol's prose (`{@link …}`). */
  links: Ref[];
}

// ── load + index ─────────────────────────────────────────────────────────────

const project = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Project;
const topLevel = project.children ?? [];

// Map a documented top-level symbol's reflection id → its name (for anchor resolution).
const idToName = new Map<number, string>();
for (const c of topLevel) if (typeof c.id === "number") idToName.set(c.id, c.name);
const nameSet = new Set<string>(topLevel.map((c) => c.name));

/** Deterministic anchor for a symbol. */
const symbolAnchor = (name: string): string => name;
/** Deterministic member anchor: `#<Symbol>.<member>`. */
const memberAnchor = (symbol: string, member: string): string => `${symbol}.${member}`;

/** Resolve a reference target to an on-page anchor, or null for external/unknown. */
function refAnchor(t: TypeNode): string | null {
  if (typeof t.target === "number") {
    const name = idToName.get(t.target);
    if (name && nameSet.has(name)) return symbolAnchor(name);
  }
  if (t.name && nameSet.has(t.name)) return symbolAnchor(t.name);
  return null;
}

// ── comment / prose extraction ───────────────────────────────────────────────

function commentSummary(c: Comment | undefined): string {
  if (!c?.summary) return "";
  return c.summary
    .map((p) => (p.kind === "inline-tag" ? (p.text ?? "") : (p.text ?? "")))
    .join("")
    .trim();
}

/** Collect `{@link Target}` cross-references in a comment's prose as Refs. */
function commentLinks(c: Comment | undefined): Ref[] {
  const out: Ref[] = [];
  const parts = [...(c?.summary ?? [])];
  for (const tag of c?.blockTags ?? []) parts.push(...tag.content);
  for (const p of parts) {
    if (p.kind !== "inline-tag") continue;
    // `{@link Name}` — text is the rendered label / target name.
    const raw = (p.text ?? "").trim();
    const targetName = raw.split(/\s+/)[0] ?? raw;
    if (!targetName) continue;
    const anchor = nameSet.has(targetName) ? symbolAnchor(targetName) : null;
    out.push({ text: targetName, anchor });
  }
  return out;
}

function commentExamples(c: Comment | undefined): string[] {
  const out: string[] = [];
  for (const tag of c?.blockTags ?? []) {
    if (tag.tag !== "@example") continue;
    const text = tag.content
      .map((p) => p.text ?? "")
      .join("")
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    if (text) out.push(text);
  }
  return out;
}

// ── type rendering → Refs (text segments, documented ones carrying an anchor) ─

function renderType(t: TypeNode | undefined): Ref[] {
  if (!t) return [{ text: "unknown", anchor: null }];
  switch (t.type) {
    case "intrinsic":
    case "literal":
      return [{ text: t.name ?? JSON.stringify(t.value), anchor: null }];
    case "reference": {
      const anchor = refAnchor(t);
      const out: Ref[] = [{ text: t.name ?? "unknown", anchor }];
      if (t.typeArguments && t.typeArguments.length > 0) {
        out.push({ text: "<", anchor: null });
        t.typeArguments.forEach((a, i) => {
          if (i > 0) out.push({ text: ", ", anchor: null });
          out.push(...renderType(a));
        });
        out.push({ text: ">", anchor: null });
      }
      return out;
    }
    case "array":
      return [...renderType(t.elementType), { text: "[]", anchor: null }];
    case "union": {
      const out: Ref[] = [];
      (t.types ?? []).forEach((u, i) => {
        if (i > 0) out.push({ text: " | ", anchor: null });
        out.push(...renderType(u));
      });
      return out;
    }
    case "tuple": {
      const out: Ref[] = [{ text: "[", anchor: null }];
      (t.elements ?? []).forEach((e, i) => {
        if (i > 0) out.push({ text: ", ", anchor: null });
        out.push(...renderType(e));
      });
      out.push({ text: "]", anchor: null });
      return out;
    }
    case "typeOperator":
      return [
        { text: `${t.operator ?? "readonly"} `, anchor: null },
        ...renderType(t.target as unknown as TypeNode),
      ];
    case "reflection":
      // inline object / function literal — render a compact placeholder
      return [{ text: t.declaration?.name === "__type" ? "{ … }" : "fn", anchor: null }];
    default:
      return [{ text: t.name ?? t.type, anchor: null }];
  }
}

const refsToText = (refs: Ref[]): string => refs.map((r) => r.text).join("");

// ── field / parameter / method extraction ────────────────────────────────────

function fieldRow(m: ReflNode): FieldRow {
  return {
    name: m.name,
    type: renderType(m.type),
    optional: Boolean(m.flags?.isOptional),
    description: commentSummary(m.comment),
  };
}

/**
 * Return a member's source line (declaration order). TypeDoc sorts `children`
 * alphabetically by default; sorting by `sources[0].line` restores the order the
 * fields are declared in `src/`.
 */
const sourceLine = (m: ReflNode): number => m.sources?.[0]?.line ?? Number.MAX_SAFE_INTEGER;
const byDeclarationOrder = (children: ReflNode[]): ReflNode[] =>
  [...children].sort((a, b) => sourceLine(a) - sourceLine(b));

/** The base-type name an inherited member came from (e.g. `GenerationDefaults`), or null. */
function inheritedBase(m: ReflNode): string | null {
  const inh = m.inheritedFrom;
  if (!inh) return null;
  if (typeof inh.target === "number") {
    const name = idToName.get(inh.target);
    if (name) return name;
  }
  // `inheritedFrom.name` is qualified (`GenerationDefaults.seed`); take the owner.
  if (inh.name) {
    const owner = inh.name.split(".")[0];
    if (owner) return owner;
  }
  return null;
}

/** A documented option/config interface/type alias → its expandable fields, or null. */
function expandableFields(t: TypeNode | undefined): FieldRow[] | undefined {
  if (!t || t.type !== "reference") return undefined;
  const name = typeof t.target === "number" ? idToName.get(t.target) : t.name;
  if (!name) return undefined;
  const decl = topLevel.find((c) => c.name === name);
  if (!decl || decl.kind !== KIND.Interface || !decl.children) return undefined;
  // Only expand interfaces whose members are all properties (an options/config bag),
  // not method-bearing interfaces (World/Registry render their own method list).
  const allProps = decl.children.every((c) => c.kind === KIND.Property);
  if (!allProps) return undefined;
  // Own fields first (declaration order), then inherited fields (so an expanded
  // options table enumerates every field a caller may pass, incl. base defaults).
  const own = byDeclarationOrder(decl.children.filter((c) => !inheritedBase(c)));
  const inherited = byDeclarationOrder(decl.children.filter((c) => inheritedBase(c)));
  return [...own, ...inherited].map((c) => fieldRow(c));
}

function paramRow(p: ParamNode): ParamRow {
  const row: ParamRow = {
    name: p.name,
    type: renderType(p.type),
    optional: Boolean(p.flags?.isOptional),
    description: commentSummary(p.comment),
  };
  const expanded = expandableFields(p.type);
  if (expanded) row.expanded = expanded;
  return row;
}

function functionSignature(sig: SignatureNode): string {
  const tp =
    sig.typeParameters && sig.typeParameters.length > 0
      ? `<${sig.typeParameters.map((t) => t.name).join(", ")}>`
      : "";
  const params = (sig.parameters ?? [])
    .map((p) => `${p.name}${p.flags?.isOptional ? "?" : ""}: ${refsToText(renderType(p.type))}`)
    .join(", ");
  return `${sig.name}${tp}(${params}): ${refsToText(renderType(sig.type))}`;
}

function methodSignature(symbol: string, m: ReflNode): MethodEntry {
  const sig = m.signatures?.[0];
  const signature = sig ? functionSignature(sig) : m.name;
  return {
    name: m.name,
    anchor: memberAnchor(symbol, m.name),
    signature,
    signatureHtml: highlight(signature),
    description: commentSummary(sig?.comment ?? m.comment),
  };
}

// ── per-symbol assembly ──────────────────────────────────────────────────────

function buildSymbol(node: ReflNode): ApiSymbol | null {
  const anchor = symbolAnchor(node.name);
  if (node.kind === KIND.Function) {
    const sig = node.signatures?.[0];
    if (!sig) return null;
    return {
      name: node.name,
      anchor,
      kind: "function",
      signature: functionSignature(sig),
      signatureHtml: highlight(functionSignature(sig)),
      description: commentSummary(sig.comment),
      examples: commentExamples(sig.comment),
      examplesHtml: commentExamples(sig.comment).map(highlight),
      params: (sig.parameters ?? []).map(paramRow),
      links: commentLinks(sig.comment),
    };
  }
  if (node.kind === KIND.Interface && node.children) {
    const hasMethods = node.children.some((c) => c.kind === KIND.Method);
    if (hasMethods) {
      return {
        name: node.name,
        anchor,
        kind: "interface",
        signature: `interface ${node.name}`,
        signatureHtml: highlight(`interface ${node.name}`),
        description: commentSummary(node.comment),
        examples: commentExamples(node.comment),
        examplesHtml: commentExamples(node.comment).map(highlight),
        methods: byDeclarationOrder(node.children.filter((c) => c.kind === KIND.Method)).map((c) =>
          methodSignature(node.name, c),
        ),
        links: commentLinks(node.comment),
      };
    }
    // option/config interface — list own fields (declaration order); inherited
    // fields are linked to the base type's entry, not re-described here.
    const ownChildren = byDeclarationOrder(node.children.filter((c) => !inheritedBase(c)));
    const inheritedChildren = node.children.filter((c) => inheritedBase(c));
    const byBase = new Map<string, InheritedRef[]>();
    for (const c of byDeclarationOrder(inheritedChildren)) {
      const base = inheritedBase(c);
      if (!base) continue;
      const list = byBase.get(base) ?? [];
      list.push({ name: c.name, anchor: memberAnchor(base, c.name) });
      byBase.set(base, list);
    }
    const inherited: InheritedGroup[] = [...byBase.entries()].map(([from, fields]) => ({
      from,
      fromAnchor: nameSet.has(from) ? symbolAnchor(from) : null,
      fields,
    }));
    const sym: ApiSymbol = {
      name: node.name,
      anchor,
      kind: "type",
      signature: `interface ${node.name}`,
      signatureHtml: highlight(`interface ${node.name}`),
      description: commentSummary(node.comment),
      examples: commentExamples(node.comment),
      examplesHtml: commentExamples(node.comment).map(highlight),
      fields: ownChildren.map((c) => fieldRow(c)),
      links: commentLinks(node.comment),
    };
    if (inherited.length > 0) sym.inherited = inherited;
    return sym;
  }
  return null;
}

// Order: functions first (the entry points), then interfaces, then option types.
const ORDER = [
  "generate",
  "createWorld",
  "createPrng",
  "World",
  "Registry",
  "GeneratorContext",
  "GenerationDefaults",
  "GenerateOptions",
  "WorldOptions",
  "SchemaOpts",
  "ExplainResult",
];

// ── syntax highlighting (Shiki, build-time) ──────────────────────────────────
// Pre-highlight every code fragment (signatures, method signatures, examples) to
// static HTML so the rendered /docs/api code blocks are syntax-coloured and visually
// consistent with the site's markdown code blocks. Same DUAL theme config + lang as
// `site/svelte.config.js` (`codeToHtml`, themes { light: github-light, dark:
// github-dark-dimmed }, defaultColor: false, lang ts) so each token carries
// `--shiki-light` / `--shiki-dark` CSS vars and the palette-switching CSS in
// app.css selects which to apply. The emitted HTML is plain serializable data
// (no node:* baked into the shipped module).
const highlighter = await createHighlighter({
  themes: ["github-light", "github-dark-dimmed"],
  langs: ["ts"],
});
const highlight = (code: string): string =>
  highlighter.codeToHtml(code, {
    lang: "ts",
    themes: { light: "github-light", dark: "github-dark-dimmed" },
    defaultColor: false,
  });

const built: ApiSymbol[] = [];
const seen = new Set<string>();
for (const name of ORDER) {
  const node = topLevel.find((c) => c.name === name);
  if (!node) continue;
  const sym = buildSymbol(node);
  if (sym) {
    built.push(sym);
    seen.add(name);
  }
}
// Append any remaining documented functions/interfaces not in the explicit order.
for (const node of topLevel) {
  if (seen.has(node.name)) continue;
  const sym = buildSymbol(node);
  if (sym) {
    built.push(sym);
    seen.add(node.name);
  }
}

// Resolve anchors against the symbols actually rendered: a reference to a top-level
// symbol that we did not render (a type alias the page omits) must degrade to plain
// text so no cross-link dangles. (The dangling-link guard then has zero false targets.)
const rendered = new Set(built.map((s) => s.name));
function pruneRefs(refs: Ref[]): void {
  for (const r of refs) {
    if (r.anchor !== null && !rendered.has(r.anchor)) r.anchor = null;
  }
}
for (const s of built) {
  pruneRefs(s.links);
  for (const p of s.params ?? []) {
    pruneRefs(p.type);
    for (const f of p.expanded ?? []) pruneRefs(f.type);
  }
  for (const f of s.fields ?? []) pruneRefs(f.type);
}

// ── emit the generated module ────────────────────────────────────────────────

const header = `/**
 * GENERATED by \`pnpm build-api-model\` (site/scripts/build-api-model.ts) from the
 * TypeDoc JSON model — DO NOT EDIT. Source of truth: the \`src/\` public exports +
 * their TSDoc, via TypeDoc. Runtime-agnostic plain data (D13).
 */

export interface ApiRef {
\treadonly text: string;
\treadonly anchor: string | null;
}
export interface ApiFieldRow {
\treadonly name: string;
\treadonly type: ReadonlyArray<ApiRef>;
\treadonly optional: boolean;
\treadonly description: string;
}
export interface ApiParamRow {
\treadonly name: string;
\treadonly type: ReadonlyArray<ApiRef>;
\treadonly optional: boolean;
\treadonly description: string;
\treadonly expanded?: ReadonlyArray<ApiFieldRow>;
}
export interface ApiMethodEntry {
\treadonly name: string;
\treadonly anchor: string;
\treadonly signature: string;
\treadonly signatureHtml: string;
\treadonly description: string;
}
export interface ApiInheritedRef {
\treadonly name: string;
\treadonly anchor: string;
}
export interface ApiInheritedGroup {
\treadonly from: string;
\treadonly fromAnchor: string | null;
\treadonly fields: ReadonlyArray<ApiInheritedRef>;
}
export interface ApiSymbol {
\treadonly name: string;
\treadonly anchor: string;
\treadonly kind: "function" | "interface" | "type" | "value";
\treadonly signature: string;
\treadonly signatureHtml: string;
\treadonly description: string;
\treadonly examples: ReadonlyArray<string>;
\treadonly examplesHtml: ReadonlyArray<string>;
\treadonly params?: ReadonlyArray<ApiParamRow>;
\treadonly fields?: ReadonlyArray<ApiFieldRow>;
\treadonly inherited?: ReadonlyArray<ApiInheritedGroup>;
\treadonly methods?: ReadonlyArray<ApiMethodEntry>;
\treadonly links: ReadonlyArray<ApiRef>;
}

export const API_MODEL: ReadonlyArray<ApiSymbol> = `;

writeFileSync(OUT_PATH, header + JSON.stringify(built, null, 2) + ";\n", "utf8");
// eslint-disable-next-line no-console -- build-time progress log
console.log(`API model: ${built.length} symbols → ${OUT_PATH}`);
