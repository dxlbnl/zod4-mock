/**
 * B126 — build-time Shiki + Twoslash highlight of docs code samples.
 *
 * Build-time only (D13-exempt: uses `node:*`, the TS language service, `twoslash`, and
 * reads the TypeDoc JSON). NOTHING here enters the shipped library `dist/` or the site
 * client bundle — it runs during the build and emits plain serializable HTML that a
 * `<CodeSample>` renders.
 *
 * Three jobs (the B126 contract):
 *  1. `highlightSample(source)` — highlight a TS sample through Shiki + `@shikijs/twoslash`
 *     with a MINIMAL renderer (NO hover popups), with the dual themes (github-light /
 *     github-dark-dimmed, `defaultColor:false`) the rest of the site uses. The sample is
 *     TYPE-CHECKED by twoslash; a sample that does not compile (undefined symbol, missing
 *     import, type error) REJECTS, naming the diagnostic (B126-R2).
 *  2. The token→anchor join (B126-R3): per twoslash hover token, resolve its declaration
 *     `{fileName,line}` via a TS language service `getDefinitionAtPosition`, join to the
 *     TypeDoc JSON `sources.{fileName,line}` index, derive `/docs/api#<anchor>`, and wrap
 *     the token in an `<a href>` via the renderer's only hook, `nodeStaticInfo`. The
 *     renderer emits NO `.twoslash-popup-*` / error / completion markup — only the link
 *     wrap on documented symbols; every other token is returned unchanged. This drops
 *     `rendererRich()`'s per-token popups (~96KB/sample → a few KB) and the overlay that
 *     made the link non-clickable.
 *  3. `resolveTokenDeclaration(source, token)` — the src-aligned join key (B126-R4): the
 *     declaration `{fileName,line}` for a token, rooted in the package `src/` (NOT
 *     node_modules / dist), because the language service + twoslash compilerOptions carry
 *     the `paths` entry `zod4-mock` → the real `src/index.ts` (mirroring
 *     `site/typedoc.tsconfig.json`), so the LS agrees with TypeDoc on src.
 *
 * A warm highlighter (`createSampleHighlighter()`) constructs the twoslasher, the Shiki
 * highlighter and the TS language service ONCE and reuses them across samples (B126-R7).
 */

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTwoslasher, type TwoslashInstance } from "twoslash";
import { transformerTwoslash, type TwoslashRenderer } from "@shikijs/twoslash";
import { createHighlighter, type HighlighterGeneric } from "shiki";
import type { Element, ElementContent } from "hast";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");
const repoRoot = resolve(siteRoot, "..");
const SRC_INDEX = resolve(repoRoot, "src", "index.ts");
const TYPEDOC_JSON = resolve(siteRoot, "src", "lib", "docs", "api", "typedoc.json");

// The compiler options used for BOTH twoslash type-checking and the LS declaration
// resolution. The `paths` entry maps `zod4-mock` → the real `src/index.ts` so the join
// key lands in `src/`, exactly like TypeDoc (`site/typedoc.tsconfig.json`). Without it
// the join silently yields 0 links (the B126 silent-fail mode).
const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
  baseUrl: repoRoot,
  paths: { "zod4-mock": [SRC_INDEX] },
};

const SAMPLE_FILE = resolve(repoRoot, "__b126_sample__.ts");

// ── the src-aligned join index: TypeDoc `sources.{fileName,line}` → anchor ────

interface DeclLocation {
  fileName: string;
  line: number;
}
type SourceIndex = Map<string, string>; // `${fileName}:${line}` → anchor

interface TypeDocSource {
  fileName: string;
  line: number;
}
interface TypeDocNode {
  name: string;
  sources?: TypeDocSource[];
  signatures?: { sources?: TypeDocSource[] }[];
}
interface TypeDocProject {
  children?: TypeDocNode[];
}

/**
 * Build the `${fileName}:${line}` → anchor index from the TypeDoc JSON. The anchor is the
 * documented top-level symbol's name (B125's anchor scheme `#<Symbol>`). Both the symbol's
 * own `sources` and its call-signature `sources` are indexed, because
 * `getDefinitionAtPosition` on a function token lands on the signature line.
 */
function buildSourceIndex(): SourceIndex {
  const project = JSON.parse(readFileSync(TYPEDOC_JSON, "utf8")) as TypeDocProject;
  const index: SourceIndex = new Map();
  for (const node of project.children ?? []) {
    const anchor = node.name;
    const locs: TypeDocSource[] = [...(node.sources ?? [])];
    for (const sig of node.signatures ?? []) locs.push(...(sig.sources ?? []));
    for (const s of locs) {
      const key = `${s.fileName.replace(/\\/g, "/")}:${s.line}`;
      if (!index.has(key)) index.set(key, anchor);
    }
  }
  return index;
}

// ── the TS language service (declaration resolution) ─────────────────────────

interface LangServiceBundle {
  service: ts.LanguageService;
  setSample: (source: string) => void;
}

/**
 * A single language service over a host that reads the real `src/` files from disk and
 * holds ONE in-memory sample file. `setSample` swaps the sample source between calls so
 * the service (and its program) is reused across every sample (B126-R7).
 */
function createLangService(): LangServiceBundle {
  let sampleSource = "";
  let sampleVersion = 0;
  const fileVersions = new Map<string, number>();

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => COMPILER_OPTIONS,
    getScriptFileNames: () => [SAMPLE_FILE],
    getScriptVersion: (fileName) => {
      if (fileName === SAMPLE_FILE) return String(sampleVersion);
      return String(fileVersions.get(fileName) ?? 0);
    },
    getScriptSnapshot: (fileName) => {
      if (fileName === SAMPLE_FILE) return ts.ScriptSnapshot.fromString(sampleSource);
      try {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"));
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => repoRoot,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const setSample = (source: string): void => {
    sampleSource = source;
    sampleVersion += 1;
  };
  return { service, setSample };
}

/**
 * Resolve the 0-based character offset `offset` in `source` to a documented symbol's
 * declaration `{fileName,line}` (line 1-based), or null. The fileName is made relative to
 * the repo root so it matches the TypeDoc `sources.fileName` shape (`src/index.ts`).
 */
function resolveDefinitionAt(
  bundle: LangServiceBundle,
  source: string,
  offset: number,
): DeclLocation | null {
  bundle.setSample(source);
  const defs = bundle.service.getDefinitionAtPosition(SAMPLE_FILE, offset);
  if (!defs || defs.length === 0) return null;
  for (const def of defs) {
    const program = bundle.service.getProgram();
    const sf = program?.getSourceFile(def.fileName);
    if (!sf) continue;
    const { line } = sf.getLineAndCharacterOfPosition(def.textSpan.start);
    const rel = relative(repoRoot, def.fileName).replace(/\\/g, "/");
    return { fileName: rel, line: line + 1 };
  }
  return null;
}

// ── the warm highlighter ──────────────────────────────────────────────────────

type Shiki = HighlighterGeneric<string, string>;

export interface EmittedLink {
  /** The token text (e.g. `generate`). */
  text: string;
  /** The `/docs/api` anchor (`<Symbol>` / `<Symbol>.<member>`) it links to. */
  anchor: string;
}

export interface SampleHighlighter {
  /** Highlight one TS sample → static HTML; rejects (naming the diagnostic) on a type error. */
  highlightSample: (source: string) => Promise<string>;
  /** Highlight a sample AND return the type-links emitted in it (for the link artifact + guard). */
  highlightSampleWithLinks: (source: string) => Promise<{ html: string; links: EmittedLink[] }>;
  /** The src-aligned declaration `{fileName,line}` for `token` in `source`, or null. */
  resolveTokenDeclaration: (source: string, token: string) => Promise<DeclLocation | null>;
}

let warmShiki: Shiki | null = null;
async function getShiki(): Promise<Shiki> {
  if (!warmShiki) {
    warmShiki = await createHighlighter({
      themes: ["github-light", "github-dark-dimmed"],
      langs: ["ts"],
    });
  }
  return warmShiki;
}

/**
 * Construct a warm highlighter: the twoslasher, the TS language service and the join
 * index are built ONCE and reused across every `highlightSample` call (B126-R7).
 */
export function createSampleHighlighter(): SampleHighlighter {
  const twoslasher: TwoslashInstance = createTwoslasher({
    compilerOptions: COMPILER_OPTIONS,
  });
  const lang = createLangService();
  const sourceIndex = buildSourceIndex();

  // Per-highlight scratch the renderer hook reads: the current sample source and the links
  // it emits. One highlight call runs synchronously through the transformer, so this is safe.
  let currentSource = "";
  let currentLinks: EmittedLink[] = [];

  // MINIMAL renderer (B126 maintainer decision): the ONLY hook is `nodeStaticInfo`, and it
  // wraps a token in an `<a>` ONLY when the token resolves to a documented `/docs/api` symbol.
  // It emits NO popup / hover-card / error / completion markup — every other twoslash render
  // hook is omitted, so the transformer skips them (`if (renderer.xxx)` guards in core). For a
  // non-documented token the bare `node` is returned unchanged. This keeps the type-check
  // (`throws: true`) + the clickable type-link join, but drops `rendererRich()`'s 30 per-token
  // popups (~96KB/sample → a few KB, and the popup no longer overlays the link).
  const renderer: TwoslashRenderer = {
    nodeStaticInfo(info, node) {
      // Resolve the hovered token's declaration → anchor. `info.start` is the 0-based
      // offset of the token in the (notation-free) sample source.
      const decl = resolveDefinitionAt(lang, currentSource, info.start);
      if (decl) {
        const key = `${decl.fileName}:${decl.line}`;
        const anchor = sourceIndex.get(key);
        if (anchor) {
          currentLinks.push({ text: info.target, anchor });
          const link: Element = {
            type: "element",
            tagName: "a",
            properties: {
              href: `/docs/api#${anchor}`,
              class: "twoslash-type-link",
              "data-twoslash-link": anchor,
            },
            children: [node] as ElementContent[],
          };
          return link as Partial<ElementContent>;
        }
      }
      // Not a documented symbol: leave the highlighted token untouched (no popup markup).
      return node as Partial<ElementContent>;
    },
  };

  const transformer = transformerTwoslash({
    explicitTrigger: false,
    twoslasher,
    renderer,
    throws: true,
    twoslashOptions: { compilerOptions: COMPILER_OPTIONS },
  });

  async function highlightSampleWithLinks(
    source: string,
  ): Promise<{ html: string; links: EmittedLink[] }> {
    const shiki = await getShiki();
    currentSource = source;
    currentLinks = [];
    let html: string;
    try {
      html = shiki.codeToHtml(source, {
        lang: "ts",
        themes: { light: "github-light", dark: "github-dark-dimmed" },
        defaultColor: false,
        transformers: [transformer],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`twoslash sample failed type-check / highlight: ${message}`);
    }
    return { html, links: currentLinks };
  }

  return {
    highlightSampleWithLinks,
    highlightSample: async (source) => (await highlightSampleWithLinks(source)).html,
    resolveTokenDeclaration: async (source, token) => {
      const offset = findTokenOffset(source, token);
      if (offset < 0) return null;
      return resolveDefinitionAt(lang, source, offset);
    },
  };
}

/**
 * Offset of a `token` identifier USE in `source` — the last occurrence as a whole word, so
 * `generate` resolves at its call site (`generate(U)`) rather than the import specifier,
 * which both resolve to the same declaration anyway.
 */
function findTokenOffset(source: string, token: string): number {
  const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) last = m.index;
  return last;
}

// ── module-scope warm singleton + the simple exports the tests call ──────────

let warm: SampleHighlighter | null = null;
function getWarm(): SampleHighlighter {
  if (!warm) warm = createSampleHighlighter();
  return warm;
}

export function highlightSample(source: string): Promise<string> {
  return getWarm().highlightSample(source);
}

export function highlightSampleWithLinks(
  source: string,
): Promise<{ html: string; links: EmittedLink[] }> {
  return getWarm().highlightSampleWithLinks(source);
}

export function resolveTokenDeclaration(
  source: string,
  token: string,
): Promise<DeclLocation | null> {
  return getWarm().resolveTokenDeclaration(source, token);
}
