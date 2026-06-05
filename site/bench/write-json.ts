/**
 * JSON write helper for the bench harness.
 *
 * `JSON.stringify(value, null, 2)` produces no trailing newline, so writing
 * bench results (`latest.json` / `history.json`) directly left the working
 * tree fmt-dirty (oxfmt requires a final `\n`). This appends exactly one.
 *
 * Lives in site/bench/* — dev-only.
 */

export function serializeJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}
