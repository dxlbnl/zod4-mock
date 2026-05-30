/**
 * @module world
 *
 * Barrel re-export for the `world/` subdirectory. The public surface is the
 * `createWorld` factory plus the `WorldImpl` class identifier (so external
 * callers — namely `src/index.ts` and the inline-schema integration test —
 * can keep importing from `./world.js` byte-identically).
 *
 * B28 layout: the legacy `src/world.ts` was split into four modules grouped
 * by concern (`engine`, `registration`, `derived`, `relations`). This barrel
 * is the single re-aggregation point so consumers see no diff. The thin
 * `src/world.ts` re-exports from this barrel so the existing
 * `import { createWorld } from "./world.js"` shape continues to resolve.
 */

export { createWorld, WorldImpl } from "./engine.js";
