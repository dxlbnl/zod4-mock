/**
 * Deep merge two objects. Non-array, non-null objects are merged recursively.
 * Arrays and other primitives from the source overwrite the target.
 */
export function deepMerge(target: unknown, source: unknown): unknown {
  if (
    typeof source !== "object" ||
    source === null ||
    Array.isArray(source) ||
    typeof target !== "object" ||
    target === null ||
    Array.isArray(target)
  ) {
    return source;
  }

  const result = { ...(target as Record<string, unknown>) };
  for (const k of Object.keys(source as Record<string, unknown>)) {
    const sv = (source as Record<string, unknown>)[k];
    result[k] = deepMerge(result[k], sv);
  }
  return result;
}
