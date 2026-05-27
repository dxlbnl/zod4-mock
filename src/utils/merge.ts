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

/**
 * Structural deep equality. Primitives compared by `Object.is`; arrays compared
 * element-wise; plain objects compared by matching key sets and recursive value
 * equality.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}
