/**
 * @module world
 *
 * Thin re-export shim for the `world/` subdirectory. B28 split the legacy
 * monolithic `src/world.ts` into four concern-grouped files
 * (`world/engine.ts`, `world/registration.ts`, `world/derived.ts`,
 * `world/relations.ts`) re-aggregated through `world/index.ts`.
 *
 * This file remains so existing imports — `import { createWorld } from
 * "./world.js"` in `src/index.ts` and `import { createWorld } from
 * "../../src/world.js"` in `tests/integration/inline-schema.test.ts` —
 * resolve byte-identically. The public API surface is unchanged.
 */

export { createWorld, WorldImpl } from "./world/index.js";
