/**
 * B102-R2 — build-time API manifest extractor.
 *
 * Reads every public export of `src/index.ts` with ts-morph and produces a
 * `ManifestSymbol` per export. The **signature is extracted from the symbol's
 * real TypeScript declaration / type — never hand-typed** (the core correctness
 * property of the hybrid model), while the description, examples, `@since`, and
 * `@see` come from the symbol's authored TSDoc. Ordering/grouping comes from the
 * hand-maintained curation layer (`./curation.js`).
 *
 * Build-time only (D13-exempt). No `any` (D1).
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CommentRange,
  type JSDoc,
  ModuleKind,
  ModuleResolutionKind,
  Node,
  Project,
  ScriptTarget,
  Symbol as MorphSymbol,
} from "ts-morph";
import { CURATION, EXCLUDE } from "./curation.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SRC_INDEX = join(REPO_ROOT, "src", "index.ts");
const LOCALE_CORE_ENTRY = join(REPO_ROOT, "packages", "locale-core", "src", "index.ts");

/** A typed parameter row extracted from a function/method signature. */
export interface ParameterRow {
  readonly name: string;
  readonly type: string;
  readonly default?: string;
  readonly description: string;
}

/** One public API symbol, assembled from extracted types + authored TSDoc + curation. */
export interface ManifestSymbol {
  readonly name: string;
  readonly kind: "function" | "type" | "namespace" | "object";
  readonly group: string;
  readonly signature: string;
  readonly description: string;
  readonly examples: ReadonlyArray<string>;
  readonly since: string;
  readonly seeAlso: ReadonlyArray<string>;
  readonly parameters?: ReadonlyArray<ParameterRow>;
}

interface ExtractedDocs {
  description: string;
  examples: string[];
  since: string;
  seeAlso: string[];
  paramDescriptions: Map<string, string>;
}

/** Read the JSDoc blocks of a declaration into description + tag content. */
function readDocs(decl: Node): ExtractedDocs {
  const out: ExtractedDocs = {
    description: "",
    examples: [],
    since: "",
    seeAlso: [],
    paramDescriptions: new Map(),
  };
  // A VariableDeclaration is not itself JSDocable — its JSDoc lives on the
  // enclosing VariableStatement. Climb to the JSDocable carrier.
  const carrier = Node.isVariableDeclaration(decl) ? (decl.getVariableStatement() ?? decl) : decl;
  if (!Node.isJSDocable(carrier)) return out;
  for (const doc of carrier.getJsDocs()) {
    collectFromJsDoc(doc, out);
  }
  return out;
}

/** Merge two doc reads, preferring the primary read but filling gaps from the fallback. */
function mergeDocs(primary: ExtractedDocs, fallback?: ExtractedDocs): ExtractedDocs {
  if (!fallback) return primary;
  return {
    description: primary.description || fallback.description,
    examples: primary.examples.length > 0 ? primary.examples : fallback.examples,
    since: primary.since || fallback.since,
    seeAlso: primary.seeAlso.length > 0 ? primary.seeAlso : fallback.seeAlso,
    paramDescriptions:
      primary.paramDescriptions.size > 0 ? primary.paramDescriptions : fallback.paramDescriptions,
  };
}

function collectFromJsDoc(doc: JSDoc, out: ExtractedDocs): void {
  const desc = doc.getDescription().trim();
  if (desc.length > 0 && out.description.length === 0) {
    out.description = desc;
  }
  for (const tag of doc.getTags()) {
    const name = tag.getTagName();
    const text = tag.getCommentText()?.trim() ?? "";
    if (name === "example") {
      out.examples.push(text);
    } else if (name === "since") {
      if (out.since.length === 0) out.since = text;
    } else if (name === "see") {
      if (text.length > 0) out.seeAlso.push(text);
    } else if (name === "param" && Node.isJSDocParameterTag(tag)) {
      const pName = tag.getName();
      // ts-morph keeps the TSDoc `- ` separator in the comment text; drop it.
      if (pName) out.paramDescriptions.set(pName, text.replace(/^-\s*/, ""));
    }
  }
}

/**
 * Parse the raw leading `/** … *\/` block of a node whose AST kind ts-morph
 * does not expose as JSDoc (e.g. an `export { … } from` re-export). Recovers
 * the description plus `@example` / `@since` / `@see` tags from the text.
 */
function parseLeadingJsDoc(ranges: ReadonlyArray<CommentRange>): ExtractedDocs | undefined {
  const block = [...ranges].reverse().find((r) => r.getText().startsWith("/**"));
  if (!block) return undefined;
  // Strip `/**`, `*/`, and the per-line leading ` * ` decoration.
  const inner = block
    .getText()
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n");

  const out: ExtractedDocs = {
    description: "",
    examples: [],
    since: "",
    seeAlso: [],
    paramDescriptions: new Map(),
  };

  // Split into the leading description and `@tag` blocks. A tag starts at a
  // line beginning with `@`; its body runs until the next such line.
  const lines = inner.split("\n");
  const descLines: string[] = [];
  let curTag: { name: string; body: string[] } | null = null;
  const flush = (): void => {
    if (!curTag) return;
    const body = curTag.body.join("\n").trim();
    if (curTag.name === "example") out.examples.push(body);
    else if (curTag.name === "since" && out.since.length === 0) out.since = body;
    else if (curTag.name === "see" && body.length > 0) out.seeAlso.push(body);
    curTag = null;
  };
  for (const line of lines) {
    const m = line.match(/^@(\w+)\s*(.*)$/);
    if (m) {
      flush();
      curTag = { name: m[1]!, body: m[2] ? [m[2]] : [] };
    } else if (curTag) {
      curTag.body.push(line);
    } else {
      descLines.push(line);
    }
  }
  flush();
  out.description = descLines.join("\n").trim();
  if (out.description.length === 0 && out.examples.length === 0) return undefined;
  return out;
}

/** Classify a declaration into a manifest kind. */
function classify(decl: Node): "function" | "type" | "namespace" | "object" {
  if (Node.isFunctionDeclaration(decl)) return "function";
  if (Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl)) {
    return "type";
  }
  if (
    Node.isModuleDeclaration(decl) ||
    Node.isNamespaceExport(decl) ||
    Node.isNamespaceImport(decl)
  ) {
    return "namespace";
  }
  // const / variable exports (objects, namespace re-exported as const, …).
  return "object";
}

/** Collapse runs of whitespace so an extracted signature is a tidy one-liner-ish block. */
function tidy(sig: string): string {
  return sig
    .replace(/[ \t]*\r?\n[ \t]*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Build the extracted signature text for a symbol from its real declaration/type. */
function extractSignature(
  name: string,
  kind: ManifestSymbol["kind"],
  decl: Node,
  symbol: MorphSymbol | undefined,
): string {
  if (kind === "function" && Node.isFunctionDeclaration(decl)) {
    // Real declaration text without the body: `function name(params): Return`.
    const params = decl
      .getParameters()
      .map((p) => p.getText())
      .join(", ");
    const typeParams = decl.getTypeParameters();
    const tp = typeParams.length > 0 ? `<${typeParams.map((t) => t.getText()).join(", ")}>` : "";
    const ret = decl.getReturnTypeNode()?.getText() ?? decl.getReturnType().getText();
    return tidy(`function ${name}${tp}(${params}): ${ret}`);
  }
  if (Node.isTypeAliasDeclaration(decl)) {
    return tidy(decl.getText());
  }
  if (Node.isInterfaceDeclaration(decl)) {
    const tp = decl.getTypeParameters();
    const tps = tp.length > 0 ? `<${tp.map((t) => t.getText()).join(", ")}>` : "";
    return tidy(`interface ${name}${tps}`);
  }
  if (kind === "namespace") {
    return `namespace ${name}`;
  }
  // object / const: render `const name: <type>` using the syntactic type node
  // when present (cheap, no checker), else the resolved type text.
  if (Node.isVariableDeclaration(decl)) {
    const typeNode = decl.getTypeNode();
    const typeText = typeNode ? typeNode.getText() : decl.getType().getText(decl);
    return tidy(`const ${name}: ${typeText}`);
  }
  // An export specifier whose target could not be resolved to a declaration in
  // this project (e.g. a cross-package re-export in the R9 fixture). Synthesize
  // a stable `type Name` signature syntactically — never invoke the checker,
  // which would be both slow and non-deterministic for an unresolved symbol.
  if (Node.isExportSpecifier(decl)) {
    return `type ${name}`;
  }
  // Fallback: the type text of the symbol at its declaration.
  if (symbol) {
    const t = symbol.getTypeAtLocation(decl).getText(decl);
    return tidy(`const ${name}: ${t}`);
  }
  return `type ${name}`;
}

/** Extract typed parameter rows for a function declaration (else undefined). */
function extractParameters(
  decl: Node,
  docs: ExtractedDocs,
): ReadonlyArray<ParameterRow> | undefined {
  if (!Node.isFunctionDeclaration(decl)) return undefined;
  const params = decl.getParameters();
  if (params.length === 0) return undefined;
  const rows: ParameterRow[] = [];
  for (const p of params) {
    const pName = p.getName();
    const typeNode = p.getTypeNode();
    const type = tidy(typeNode ? typeNode.getText() : p.getType().getText(p));
    const init = p.getInitializer();
    const description = docs.paramDescriptions.get(pName) ?? "";
    const row: ParameterRow = init
      ? { name: pName, type, default: tidy(init.getText()), description }
      : { name: pName, type, description };
    rows.push(row);
  }
  return rows;
}

/** Build the ordered API manifest from `src/index.ts` (extraction + curation). */
export function buildManifest(): ReadonlyArray<ManifestSymbol> {
  // Lean, in-memory Project: add only the library's own source (and the
  // locale-core source for cross-package type/JSDoc), skipping the heavy
  // tsconfig + full dependency-graph resolution. This keeps `buildManifest`
  // fast enough for the R9 parity-guard fixture (which runs the generator
  // several times against a temp copy of the tree).
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipLoadingLibFiles: true,
    compilerOptions: {
      target: ScriptTarget.ES2022,
      module: ModuleKind.Node16,
      moduleResolution: ModuleResolutionKind.Node16,
      skipLibCheck: true,
      noLib: true,
      allowJs: false,
      baseUrl: REPO_ROOT,
      // Resolve `@zod4-mock/locale-core` to its SOURCE (not the gitignored
      // `dist/.d.ts`), so a clean checkout extracts the cross-package TSDoc
      // (LocaleData / Currency / Prng) without a prior build. In the R9 parity
      // fixture (which omits `packages/`) this simply fails to resolve and the
      // extractor falls back to a stable `type Name` signature — deterministic.
      paths: {
        "@zod4-mock/locale-core": [LOCALE_CORE_ENTRY],
      },
    },
  });
  const indexFile = project.addSourceFileAtPath(SRC_INDEX);
  // The re-export chain (incl. cross-package `@zod4-mock/locale-core` types) is
  // resolved lazily by `getExportedDeclarations`.

  const exportMap = indexFile.getExportedDeclarations();
  // Syntactic map of any locally-authored TSDoc on an `export const NAME = …`
  // in `src/index.ts` (e.g. `data` / `generators`), keyed by name. Built from
  // the source AST — no type checker — to recover prose the resolved namespace
  // declaration does not carry.
  const localDocs = new Map<string, ExtractedDocs>();
  for (const stmt of indexFile.getVariableStatements()) {
    if (!stmt.isExported()) continue;
    for (const d of stmt.getDeclarations()) {
      localDocs.set(d.getName(), readDocs(d));
    }
  }

  // TSDoc authored on a re-export statement in `src/index.ts`
  // (`export { createPrng, fieldSeed } from "./prng.js"`) does not live on the
  // resolved declaration ts-morph reads, so `@example` blocks placed there are
  // otherwise lost. Read each re-export ExportDeclaration's JSDoc and key it by
  // every named export it re-exports; merged in as a fallback below.
  const reexportDocs = new Map<string, ExtractedDocs>();
  for (const exp of indexFile.getExportDeclarations()) {
    const named = exp.getNamedExports();
    if (named.length === 0) continue;
    // An `export { … } from "…"` ExportDeclaration is not JSDocable in this
    // ts-morph version, so its leading `/** … */` block isn't surfaced as a
    // JSDoc node. Parse the raw leading-comment text instead.
    const docs = parseLeadingJsDoc(exp.getLeadingCommentRanges());
    if (!docs) continue;
    for (const spec of named) {
      reexportDocs.set(spec.getName(), docs);
    }
  }

  const built = new Map<string, ManifestSymbol>();

  for (const [name, declList] of exportMap) {
    if (name === "default" || EXCLUDE.includes(name)) continue;

    // The resolved underlying declaration (good for kind / signature). When a
    // cross-package re-export can't be resolved to a declaration in this
    // project (e.g. the R9 parity fixture omits `packages/`), synthesize a
    // stable `type Name` signature so output stays deterministic.
    const decl = declList[0];
    if (!decl) {
      const sym: ManifestSymbol = {
        name,
        kind: "type",
        group: "",
        signature: `type ${name}`,
        description: "",
        examples: [],
        since: "",
        seeAlso: [],
      };
      built.set(name, sym);
      continue;
    }

    const declSymbol = decl.getSymbol();
    const kind = classify(decl);
    // Read docs from the resolved declaration, then fall back to any locally
    // authored TSDoc on a `src/index.ts` `export const NAME = …` (recovers prose
    // for the `data` / `generators` namespace re-exports as plain consts).
    const docs = mergeDocs(readDocs(decl), localDocs.get(name) ?? reexportDocs.get(name));
    const signature = extractSignature(name, kind, decl, declSymbol);
    if (signature.trim().length === 0) {
      throw new Error(`B102 extract: empty signature extracted for export \`${name}\``);
    }
    const parameters = extractParameters(decl, docs);

    const sym: ManifestSymbol = {
      name,
      kind,
      group: "",
      signature,
      description: docs.description,
      examples: docs.examples,
      since: docs.since,
      seeAlso: docs.seeAlso,
      ...(parameters ? { parameters } : {}),
    };
    built.set(name, sym);
  }

  // Order by curation; append un-curated public symbols (sorted) and assign groups.
  const ordered: ManifestSymbol[] = [];
  const seen = new Set<string>();
  for (const entry of CURATION) {
    const sym = built.get(entry.name);
    if (!sym) continue; // curated name no longer exported — coverage check elsewhere catches drift
    ordered.push({ ...sym, group: entry.group });
    seen.add(entry.name);
  }
  const uncurated = [...built.keys()].filter((n) => !seen.has(n)).sort();
  for (const n of uncurated) {
    const sym = built.get(n)!;
    ordered.push({ ...sym, group: "Other" });
  }

  return ordered;
}
