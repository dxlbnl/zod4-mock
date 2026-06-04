/**
 * B100-R6 — type-level test that `<SpeedClaim>` requires `source`.
 *
 * Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
 * (B100-R6 scenario 1, "TypeScript rejects a missing `source` prop").
 *
 * Run command: `pnpm site:check` (svelte-check picks up `.ts` files in
 * the SvelteKit project).
 *
 * Red signal (today, no implementation):
 *   - The import `./SpeedClaim.svelte` resolves to nothing — svelte-check
 *     reports "Cannot find module './SpeedClaim.svelte'".
 *   - The `// @ts-expect-error` line below is therefore *not* consumed
 *     (svelte-check reports "Unused @ts-expect-error directive").
 *
 * Green signal (after implementation):
 *   - The import resolves to a Svelte component whose Props interface
 *     declares `source: string` as a required (non-optional) property.
 *   - The full-props line type-checks cleanly.
 *   - The `// @ts-expect-error` line is consumed (the omission of
 *     `source` would otherwise error).
 *
 * This file is structured so the failure mode flips from "module not
 * found" (RED) to "expected error consumed" (GREEN) — i.e. the test
 * tells you which side of the cycle you're on.
 */

import type { ComponentProps } from "svelte";
import SpeedClaim from "./SpeedClaim.svelte";

type SpeedClaimProps = ComponentProps<typeof SpeedClaim>;

// `source` MUST be a required, non-optional property on the Props type.
// If `source` ever becomes optional this `never` assignment fires.
type SourceIsRequired = undefined extends SpeedClaimProps["source"] ? never : true;
const _sourceIsRequired: SourceIsRequired = true;

// Sanity: with all four required props the type checks.
const _full: SpeedClaimProps = {
  tier: "user",
  value: "2.7×",
  vs: "@anatine/zod-mock",
  source: "site/bench/results/latest.json",
};

// The key assertion: omitting `source` MUST be a compile-time error.
// The directive on the next line is the assertion — svelte-check fails
// if it's either unused (source isn't actually required → spec
// violated) or if the suppressed line still type-checks for any other
// reason. TypeScript reports the "Property 'source' is missing" error
// on the line of the variable declaration (where the contextual type
// is applied), not on a property line inside the literal — the
// directive therefore sits immediately above the `const` line.
// @ts-expect-error — B100-R6: `source` is required (D17/D20)
const _missingSource: SpeedClaimProps = {
  tier: "user",
  value: "2.7×",
  vs: "@anatine/zod-mock",
};

// Mark the test artefacts as intentionally used so unused-locals checks
// don't drown out the real signal.
void _sourceIsRequired;
void _full;
void _missingSource;
