import type { GeneratorContext } from "../../types.js";

// Matching is normalised (case-insensitive, underscores stripped) so
// "firstName"/"first_name"/"voornaam" resolve against the same slot.
export function siblingString(
  ctx: GeneratorContext | undefined,
  ...candidates: string[]
): string | undefined {
  if (!ctx?.current) return undefined;
  for (const candidate of candidates) {
    const norm = candidate.toLowerCase().replace(/_/g, "");
    for (const [k, v] of Object.entries(ctx.current)) {
      if (typeof v === "string" && v.length > 0) {
        if (k === candidate || k.toLowerCase().replace(/_/g, "") === norm) return v;
      }
    }
  }
  return undefined;
}
