/**
 * B70 — Unify CLI + browser bench schema set.
 *
 * One test per requirement ID from
 * wiki/specs/B70-site-unify-cli-browser-schemas.md. Failure modes today
 * (pre-fix) are noted per block; each test fails because the canonical
 * schema files / index do not yet exist, or because the CLI / browser
 * consumers still inline-define their schemas.
 *
 * RED CHECK: `pnpm site:test:unit` + `pnpm site:check`. The perf gate
 * (`pnpm site:bench`) is not run for RED.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// site/src/lib/schemas/ → site root is three levels up.
const SITE_ROOT = join(__dirname, "..", "..", "..");
const SCHEMAS_DIR = join(SITE_ROOT, "src", "lib", "schemas");
const BENCH_DIR = join(SITE_ROOT, "bench");
const RUNNERS_DIR = join(SITE_ROOT, "src", "lib", "runners");
const ROUTES_BENCH = join(SITE_ROOT, "src", "routes", "bench");

function readText(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// B70-R1 — canonical schema location, no inline schemas in consumers
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R1 / canonical schema location", () => {
  it("B70-R1 / no inline z.object schemas remain in CLI bench files", () => {
    // Spec scenario 1: regex `z(3|4)?\.object\(\s*\{` MUST only match inside
    // comments / string literals (no top-level const schema definitions).
    const files = [
      "perf.test.ts",
      "regression.bench.ts",
      "perf-thresholds.test.ts",
      "baseline-matcher.test.ts",
      "matcher-tier-shape.test.ts",
    ].map((f) => join(BENCH_DIR, f));

    const offenders: { file: string; matches: string[] }[] = [];
    for (const file of files) {
      const src = readText(file);
      // Strip line comments and block comments to make the source-text grep
      // robust to legitimate explanatory comments that mention z.object(...).
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      // Top-level inline-object schema definition pattern: `const X = z(3|4)?.object({`
      // (after const/let/var assignment). This catches the perf.test.ts /
      // regression.bench.ts top-level inline shapes the spec requires moved out.
      const re = /\b(?:const|let|var)\s+\w+\s*=\s*z(?:3|4)?\.object\(\s*\{/g;
      const matches = stripped.match(re) ?? [];
      if (matches.length > 0) offenders.push({ file, matches });
    }
    expect(
      offenders,
      `Expected no inline z.object schema definitions in CLI bench files; found: ${JSON.stringify(offenders.map((o) => ({ file: o.file.split("/site/")[1], n: o.matches.length })))}`,
    ).toEqual([]);
  });

  it("B70-R1 / CLI bench files import schemas from ../src/lib/schemas/", () => {
    // Spec scenario 1 second clause: each file MUST import its schemas via
    // `from "../src/lib/schemas/..."` (relative path from site/bench/).
    const files = ["perf.test.ts", "regression.bench.ts", "perf-thresholds.test.ts"].map((f) =>
      join(BENCH_DIR, f),
    );

    for (const file of files) {
      const src = readText(file);
      const hasImport = /from\s+["']\.\.\/src\/lib\/schemas(\/[^"']+|["'])/.test(src);
      expect(hasImport, `${file.split("/site/")[1]} must import from ../src/lib/schemas/`).toBe(
        true,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R2 — dual zod4 + zod3 export per canonical schema (D16)
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R2 / dual zod4 + zod3 export per canonical schema", () => {
  it("B70-R2 / simple.ts pairs zod4 (simple) with zod3 (simple3)", async () => {
    // Spec R7 enumerates the canonical names; this checks the pairing.
    const mod = (await import(join(SCHEMAS_DIR, "simple.ts"))) as Record<string, unknown>;
    expect(mod.simple, "simple.ts must export `simple` (zod4)").toBeDefined();
    expect(mod.simple3, "simple.ts must export `simple3` (zod3 parity)").toBeDefined();

    // Same field-name ordering on the two forms (spec R2 scenario 1).
    const simple = mod.simple as { shape: Record<string, unknown> };
    const simple3 = mod.simple3 as { shape: Record<string, unknown> };
    expect(Object.keys(simple3.shape)).toEqual(Object.keys(simple.shape));
  });

  it("B70-R2 / user.ts pairs zod4 (user) with zod3 (user3)", async () => {
    const mod = (await import(join(SCHEMAS_DIR, "user.ts"))) as Record<string, unknown>;
    expect(mod.user).toBeDefined();
    expect(mod.user3).toBeDefined();
    const user = mod.user as { shape: Record<string, unknown> };
    const user3 = mod.user3 as { shape: Record<string, unknown> };
    expect(Object.keys(user3.shape)).toEqual(Object.keys(user.shape));
  });

  it("B70-R2 / nested.ts pairs zod4 (nested) with zod3 (nested3)", async () => {
    const mod = (await import(join(SCHEMAS_DIR, "nested.ts"))) as Record<string, unknown>;
    expect(
      mod.nested,
      "nested.ts must export `nested` (zod4, CLI mixed-features shape)",
    ).toBeDefined();
    expect(mod.nested3, "nested.ts must export `nested3` (zod3 parity)").toBeDefined();
    // The CLI mixed-features shape has 7 fields per R4 scenario 3.
    const nested = mod.nested as { shape: Record<string, unknown> };
    expect(Object.keys(nested.shape)).toHaveLength(7);
  });

  it("B70-R2 / matcher tier is zod4-only (no zod3 parity expected)", async () => {
    // Spec R2 scenario 3: matcher tier is zod4-mock-specific (relations).
    const mod = (await import(join(SCHEMAS_DIR, "matcher.ts"))) as Record<string, unknown>;
    expect(mod.CompanySchema).toBeDefined();
    expect(mod.UserSchema).toBeDefined();
    expect(mod.AddressSchema).toBeDefined();
    // Carve-out: explicitly NOT testing a `*Schema3` parity for matcher.
    expect(mod.UserSchema3, "matcher tier is zod4-only — no UserSchema3 expected").toBeUndefined();
  });

  it("B70-R2 / every schema file that imports zod3 also exports a *3 parity", () => {
    // D16 compliance per spec R2 scenario 2: every `"zod3"` import paired
    // with a `<name>3` benchmark/parity export.
    const filesToCheck = ["simple.ts", "user.ts", "nested.ts", "array.ts", "nestedOrder.ts"];

    for (const file of filesToCheck) {
      const p = join(SCHEMAS_DIR, file);
      // File must exist (R1) and follow the dual-export pattern.
      expect(existsSync(p), `expected canonical file ${file} to exist`).toBe(true);
      const src = readText(p);
      const importsZod3 = /from\s+["']zod3["']/.test(src);
      expect(importsZod3, `${file} must import from "zod3"`).toBe(true);
      // At least one `*3` named export.
      const hasParityExport = /export\s+const\s+\w+3\s*=/.test(src);
      expect(hasParityExport, `${file} must export at least one *3 parity form`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R3 — module-scope reference identity (D4 / D10)
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R3 / module-scope reference identity", () => {
  it("B70-R3 / each canonical schema is a const at module scope, not a factory", () => {
    // Spec R3 scenario: two imports of S MUST resolve to the same reference.
    // The structural test for this is that the export is a `const` (not a
    // function returning a fresh schema each call). Source-text grep.
    const files = ["simple.ts", "user.ts", "nested.ts", "matcher.ts", "nestedOrder.ts", "array.ts"];
    for (const file of files) {
      const p = join(SCHEMAS_DIR, file);
      expect(existsSync(p), `expected canonical file ${file} to exist`).toBe(true);
      const src = readText(p);
      // No `export function` definition of a canonical schema (factory pattern
      // would break D4/D10 reference identity).
      expect(
        /export\s+function\s+\w+\s*\([^)]*\)\s*[:{]/.test(src),
        `${file}: schemas must be const exports, not factory functions (D4/D10)`,
      ).toBe(false);
      // At least one `export const` schema entry.
      expect(/export\s+const\s+\w+\s*=/.test(src), `${file}: must export schemas as const`).toBe(
        true,
      );
    }
  });

  it("B70-R3 / two imports of `simple` yield the same reference", async () => {
    // Dynamic import twice (Node caches modules → same instance). Asserts the
    // module-scope const is stable across consumers.
    const a = (await import(join(SCHEMAS_DIR, "simple.ts"))) as { simple: unknown };
    const b = (await import(join(SCHEMAS_DIR, "simple.ts"))) as { simple: unknown };
    expect(a.simple).toBe(b.simple);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R4 — CLI perf-baseline byte-equivalence
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R4 / CLI perf-baseline byte-equivalence", () => {
  it("B70-R4 / simple-tier byte-equivalence (no .uuid/.min/.max, 4 plain fields)", async () => {
    const mod = (await import(join(SCHEMAS_DIR, "simple.ts"))) as {
      simple: { shape: Record<string, { _zod: { def: { type: string; checks?: unknown[] } } }> };
    };
    const shape = mod.simple.shape;
    expect(Object.keys(shape)).toEqual(["id", "name", "age", "active"]);

    // Plain primitive — no checks, no formats — per spec R4 scenario 1.
    expect(shape.id!._zod.def.type).toBe("string");
    expect(shape.id!._zod.def.checks ?? []).toEqual([]);
    expect(shape.name!._zod.def.type).toBe("string");
    expect(shape.name!._zod.def.checks ?? []).toEqual([]);
    expect(shape.age!._zod.def.type).toBe("number");
    expect(shape.age!._zod.def.checks ?? []).toEqual([]);
    expect(shape.active!._zod.def.type).toBe("boolean");
  });

  it("B70-R4 / user-tier byte-equivalence", async () => {
    const mod = (await import(join(SCHEMAS_DIR, "user.ts"))) as {
      user: { shape: Record<string, { _zod: { def: { type: string } } }> };
    };
    const shape = mod.user.shape;
    expect(Object.keys(shape)).toEqual([
      "id",
      "firstName",
      "lastName",
      "email",
      "age",
      "role",
      "bio",
      "score",
    ]);
    expect(shape.id!._zod.def.type).toBe("string");
    expect(shape.email!._zod.def.type).toBe("string");
    expect(shape.age!._zod.def.type).toBe("number");
    // role enum is type "enum".
    expect(shape.role!._zod.def.type).toBe("enum");
    // bio is optional → wrapped.
    expect(shape.bio!._zod.def.type).toBe("optional");
    expect(shape.score!._zod.def.type).toBe("number");
  });

  it("B70-R4 / nested-tier byte-equivalence (mixed-features CLI shape)", async () => {
    const mod = (await import(join(SCHEMAS_DIR, "nested.ts"))) as {
      nested: {
        shape: Record<
          string,
          {
            _zod: { def: { type: string; innerType?: { shape?: Record<string, unknown> } } };
            shape?: Record<string, unknown>;
          }
        >;
      };
    };
    const shape = mod.nested.shape;
    expect(Object.keys(shape)).toEqual([
      "id",
      "name",
      "email",
      "address",
      "billingAddress",
      "tags",
      "metadata",
    ]);

    // address is an inner object with the four-key shape (R4 scenario 3).
    const address = shape.address!;
    const addrShape = address.shape ?? address._zod.def.innerType?.shape;
    expect(addrShape, "nested.address must be an object schema with .shape").toBeDefined();
    expect(Object.keys(addrShape!)).toEqual(["street", "city", "country", "zip"]);

    // billingAddress is the address made `.optional()`.
    expect(shape.billingAddress!._zod.def.type).toBe("optional");

    // tags is an array; metadata is a record.
    expect(shape.tags!._zod.def.type).toBe("array");
    expect(shape.metadata!._zod.def.type).toBe("record");
  });

  it("B70-R4 / matcher-tier byte-equivalence (Company / Address / UserSchema)", async () => {
    const mod = (await import(join(SCHEMAS_DIR, "matcher.ts"))) as {
      CompanySchema: { shape: Record<string, { _zod: { def: { type: string } } }> };
      AddressSchema: { shape: Record<string, unknown> };
      UserSchema: { shape: Record<string, { _zod: { def: { type: string } } }> };
    };
    expect(Object.keys(mod.CompanySchema.shape)).toEqual(["id", "name", "industry"]);
    expect(Object.keys(mod.AddressSchema.shape)).toEqual(["street", "city", "country"]);
    expect(Object.keys(mod.UserSchema.shape)).toEqual([
      "id",
      "fullName",
      "email",
      "city",
      "address",
      "employerId",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R5 — CLI bench imports the canonical schemas
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R5 / CLI bench imports the canonical schemas", () => {
  it("B70-R5 / perf.test.ts has no top-level inline simple4/user4/nested4/matcher schema definitions", () => {
    // Spec R5 scenario 1: previous top-level `const simple4 = ...`,
    // `const user4 = ...`, `const nested4 = ...`, `const CompanySchema = ...`,
    // `const AddressSchema = ...`, `const UserSchema = ...` MUST be removed.
    const src = readText(join(BENCH_DIR, "perf.test.ts"));
    const banned = [
      /^const\s+simple3\s*=/m,
      /^const\s+simple4\s*=/m,
      /^const\s+user3\s*=/m,
      /^const\s+user4\s*=/m,
      /^const\s+nested3\s*=/m,
      /^const\s+nested4\s*=/m,
      /^const\s+address3\s*=/m,
      /^const\s+address4\s*=/m,
      /^const\s+CompanySchema\s*=/m,
      /^const\s+AddressSchema\s*=/m,
      /^const\s+UserSchema\s*=/m,
    ];
    const hits = banned.filter((re) => re.test(src)).map(String);
    expect(hits, `perf.test.ts must no longer define these inline: ${hits.join(", ")}`).toEqual([]);
  });

  it("B70-R5 / perf.test.ts imports simple / user / nested / matcher from ../src/lib/schemas/", () => {
    const src = readText(join(BENCH_DIR, "perf.test.ts"));
    expect(/from\s+["']\.\.\/src\/lib\/schemas\/simple["']/.test(src)).toBe(true);
    expect(/from\s+["']\.\.\/src\/lib\/schemas\/user["']/.test(src)).toBe(true);
    expect(/from\s+["']\.\.\/src\/lib\/schemas\/nested["']/.test(src)).toBe(true);
    expect(/from\s+["']\.\.\/src\/lib\/schemas\/matcher["']/.test(src)).toBe(true);
  });

  it("B70-R5 / regression.bench.ts has no inline simple/user/nested/matcher schemas", () => {
    const src = readText(join(BENCH_DIR, "regression.bench.ts"));
    const banned = [
      /^const\s+simple\s*=/m,
      /^const\s+user\s*=/m,
      /^const\s+nested\s*=/m,
      /^const\s+address\s*=/m,
      /^const\s+CompanySchema\s*=/m,
      /^const\s+AddressSchema\s*=/m,
      /^const\s+UserSchema\s*=/m,
    ];
    const hits = banned.filter((re) => re.test(src)).map(String);
    expect(
      hits,
      `regression.bench.ts must no longer define these inline: ${hits.join(", ")}`,
    ).toEqual([]);
  });

  it("B70-R5 / regression.bench.ts imports its schemas from ../src/lib/schemas/", () => {
    const src = readText(join(BENCH_DIR, "regression.bench.ts"));
    expect(/from\s+["']\.\.\/src\/lib\/schemas[\/"']/.test(src)).toBe(true);
  });

  it("B70-R5 / matcher-tier-shape.test.ts grep assertions still pass post-import", () => {
    // Spec R5 scenario 2: the matcher-tier-shape source greps for
    // "CompanySchema", "UserSchema", "fullName", "email", "city", "address",
    // "employerId" against perf.test.ts. The names must survive via the
    // import line in perf.test.ts.
    const src = readText(join(BENCH_DIR, "perf.test.ts"));
    expect(src).toContain("CompanySchema");
    expect(src).toContain("UserSchema");
    expect(src).toContain("fullName");
    expect(src).toContain("email");
    expect(src).toContain("city");
    expect(src).toContain("address");
    expect(src).toContain("employerId");
    expect(src).toMatch(/describe\(["']matcher schema["']/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R6 — browser bench imports the canonical schemas
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R6 / browser bench imports the canonical schemas", () => {
  it("B70-R6 / zod4mock.ts has no inline z.object schema definitions", () => {
    const src = readText(join(RUNNERS_DIR, "zod4mock.ts"));
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    // Any top-level `z.object({` definition is banned.
    expect(/\bz\.object\(\s*\{/.test(stripped)).toBe(false);
  });

  it("B70-R6 / zod4mock.ts imports the canonical *names* (simple / nestedOrder / array) — not the deleted flatSchema", () => {
    // Pre-change: zod4mock.ts imports `flatSchema`, `nestedSchema`, `arraySchema`.
    // Post-change: imports the canonical `simple`, `nestedOrder`, `array`
    // names per the R6 segmented-control set + R7 naming. The deleted
    // `flatSchema` import MUST be gone (flat.ts is deleted per the spec's
    // canonical-naming decision).
    const src = readText(join(RUNNERS_DIR, "zod4mock.ts"));
    expect(/from\s+["'](?:\.\.\/schemas|\$lib\/schemas)/.test(src)).toBe(true);
    // The legacy `flatSchema` symbol must no longer be imported (R6 + spec
    // canonical-naming decision: flat.ts is deleted, `flat` becomes `simple`).
    expect(/\bflatSchema\b/.test(src)).toBe(false);
    // The legacy `nestedSchema` name is replaced by `nestedOrder` (R7).
    expect(/\bnestedSchema\b/.test(src)).toBe(false);
    // The legacy `arraySchema` is renamed to `array` (R7 + open question §3).
    expect(/\barraySchema\b/.test(src)).toBe(false);
  });

  it("B70-R6 / zodmock.ts imports the canonical *3 parity names — not the deleted flatSchema3", () => {
    const src = readText(join(RUNNERS_DIR, "zodmock.ts"));
    expect(/from\s+["'](?:\.\.\/schemas|\$lib\/schemas)/.test(src)).toBe(true);
    // No inline z3.object definitions.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(/\bz3\.object\(\s*\{/.test(stripped)).toBe(false);
    // Legacy parity symbols replaced.
    expect(/\bflatSchema3\b/.test(src)).toBe(false);
    expect(/\bnestedSchema3\b/.test(src)).toBe(false);
    expect(/\barraySchema3\b/.test(src)).toBe(false);
  });

  it("B70-R6 / ecommerce.ts (runner) imports its schemas from canonical schemas dir", () => {
    const src = readText(join(RUNNERS_DIR, "ecommerce.ts"));
    // ecommerce.ts already imports from ../schemas/ecommerce today, but the
    // R6 contract is: post-change, importing the canonical *names* from
    // canonical files. The runner's userSchema/categorySchema/... names are
    // preserved by R7. We assert the import-source pattern AND that the
    // file does not redeclare schemas inline.
    expect(/from\s+["'](?:\.\.\/schemas|\$lib\/schemas)/.test(src)).toBe(true);
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(
      /\bz\.object\(\s*\{/.test(stripped),
      "ecommerce.ts (runner) must not define z.object schemas inline (R6)",
    ).toBe(false);
  });

  it("B70-R6 / /bench segmented control surfaces a subset of canonical names", () => {
    // Spec R6 scenario: schemaOptions values MUST be a subset of the canonical
    // schema names. Post-change baseline option set: ["simple", "nestedOrder",
    // "array"].
    const src = readText(join(ROUTES_BENCH, "+page.svelte"));
    // Find each `value: '...'` literal inside the schemaOptions array.
    // Simple structural grep — the option list must include 'simple' (replacing
    // 'flat'); 'nestedOrder' (renamed from 'nested'); and keep 'array'.
    expect(src).toMatch(/value:\s*['"]simple['"]/);
    expect(src).toMatch(/value:\s*['"]nestedOrder['"]/);
    expect(src).toMatch(/value:\s*['"]array['"]/);
    // The legacy 'flat' option must be gone (it was deleted per the spec's
    // canonical-naming decision).
    expect(/value:\s*['"]flat['"]/.test(src)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R7 — canonical index re-exports the full set
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R7 / canonical index exports the full set", () => {
  it("B70-R7 / site/src/lib/schemas/index.ts exists", () => {
    expect(existsSync(join(SCHEMAS_DIR, "index.ts"))).toBe(true);
  });

  it("B70-R7 / index.ts re-exports every canonical named entry", async () => {
    // Spec R7 scenario 1: the named export set must include at minimum
    // simple, simple3, user, user3, nested, nested3, address, address3,
    // nestedOrder, nestedOrder3, array, array3, ecommerce companions
    // (userSchema, categorySchema, productSchema, variantSchema,
    // reviewSchema, orderSchema), and the matcher tier (CompanySchema,
    // AddressSchema, UserSchema).
    const mod = (await import(join(SCHEMAS_DIR, "index.ts"))) as Record<string, unknown>;
    const expected = [
      "simple",
      "simple3",
      "user",
      "user3",
      "nested",
      "nested3",
      "address",
      "address3",
      "nestedOrder",
      "nestedOrder3",
      "array",
      "array3",
      "userSchema",
      "categorySchema",
      "productSchema",
      "variantSchema",
      "reviewSchema",
      "orderSchema",
      "CompanySchema",
      "AddressSchema",
      "UserSchema",
    ];
    const missing = expected.filter((k) => mod[k] === undefined);
    expect(missing, `index.ts must re-export at minimum: ${expected.join(", ")}`).toEqual([]);
  });

  it("B70-R7 / matcher-tier UserSchema and ecommerce userSchema coexist case-distinguished", async () => {
    // Spec R7 scenario 1 closing note: PascalCase `UserSchema` is matcher's,
    // camelCase `userSchema` is ecommerce's; both MUST be present and
    // distinct references.
    const mod = (await import(join(SCHEMAS_DIR, "index.ts"))) as Record<string, unknown>;
    expect(mod.UserSchema).toBeDefined();
    expect(mod.userSchema).toBeDefined();
    expect(mod.UserSchema).not.toBe(mod.userSchema);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R8 — schemas.test.ts covers the unified set
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R8 / schema unit tests cover the unified set", () => {
  it("B70-R8 / schemas.test.ts asserts simple shape ['id','name','age','active']", () => {
    const src = readText(join(SCHEMAS_DIR, "schemas.test.ts"));
    // Spec R8 scenario 1: assert Object.keys(simple.shape) equals
    // ['id','name','age','active'].
    expect(
      src.includes("simple") &&
        /\[\s*["']id["']\s*,\s*["']name["']\s*,\s*["']age["']\s*,\s*["']active["']\s*\]/.test(src),
    ).toBe(true);
  });

  it("B70-R8 / schemas.test.ts asserts user shape ordering", () => {
    const src = readText(join(SCHEMAS_DIR, "schemas.test.ts"));
    // Spec R8 scenario 2: assert Object.keys(user.shape) equals the 8-field list.
    expect(
      /\[\s*["']id["']\s*,\s*["']firstName["']\s*,\s*["']lastName["']\s*,\s*["']email["']\s*,\s*["']age["']\s*,\s*["']role["']\s*,\s*["']bio["']\s*,\s*["']score["']\s*\]/.test(
        src,
      ),
    ).toBe(true);
  });

  it("B70-R8 / schemas.test.ts asserts matcher-tier UserSchema fields", () => {
    const src = readText(join(SCHEMAS_DIR, "schemas.test.ts"));
    // Spec R8 scenario 3: UserSchema.shape exposes employerId, address,
    // fullName, email, city.
    expect(src).toContain("UserSchema");
    expect(src).toContain("employerId");
    expect(src).toContain("fullName");
    // CompanySchema test mentioned by spec.
    expect(src).toContain("CompanySchema");
  });

  it("B70-R8 / schemas.test.ts asserts nestedOrder.customer.address shape", () => {
    const src = readText(join(SCHEMAS_DIR, "schemas.test.ts"));
    // Spec R8 scenario 4: nestedOrder.shape.customer.shape.address.shape has
    // the keys ['street','city','state','zip','country'].
    expect(src).toContain("nestedOrder");
    expect(
      /\[\s*["']street["']\s*,\s*["']city["']\s*,\s*["']state["']\s*,\s*["']zip["']\s*,\s*["']country["']\s*\]/.test(
        src,
      ),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B70-R9 — baseline.json and versions.json are not touched (byte-identical)
// ─────────────────────────────────────────────────────────────────────────────

describe("B70-R9 / baseline.json and versions.json unchanged", () => {
  // Spec R9: byte-for-byte unchanged. The structural check here pins the
  // current SHA-256-equivalent contents (we use the parsed JSON's
  // tier-name set as a stable proxy: matcher / simple / user / nested
  // keys MUST still be those names exactly, never renamed).
  it("B70-R9 / baseline.json still keys tiers as simple/user/nested/matcher", () => {
    const baselinePath = join(BENCH_DIR, "results", "baseline.json");
    expect(existsSync(baselinePath)).toBe(true);
    const baseline = JSON.parse(readText(baselinePath)) as {
      results: Record<string, unknown>;
      memory: Record<string, unknown>;
    };
    // Per B97/B98 the four tier keys are simple/user/nested/matcher.
    // R9 says the diff is empty post-B70 → the keyset survives.
    expect(Object.keys(baseline.results).sort()).toEqual(
      ["matcher", "nested", "simple", "user"].sort(),
    );
    expect(Object.keys(baseline.memory).sort()).toEqual(
      ["matcher", "nested", "simple", "user"].sort(),
    );
  });

  it("B70-R9 / versions.json schemas block keys are simple/user/nested", () => {
    const versionsPath = join(BENCH_DIR, "results", "versions.json");
    expect(existsSync(versionsPath)).toBe(true);
    const file = JSON.parse(readText(versionsPath)) as {
      schemas?: Record<string, string>;
    };
    // R9 second scenario: versions.json (`schemas` documentation block)
    // is unchanged. The pre-change keys are simple/user/nested.
    expect(file.schemas).toBeDefined();
    expect(Object.keys(file.schemas!).sort()).toEqual(["nested", "simple", "user"].sort());
  });
});
