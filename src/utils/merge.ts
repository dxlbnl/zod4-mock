/**
 * Same-realm "plain object" predicate. A value is a plain object iff its
 * prototype is `Object.prototype` (an object literal `{}`) or `null`
 * (an `Object.create(null)`-backed dict). Atomic objects — `Date`, `Map`,
 * `Set`, `RegExp`, `URL`, `Buffer`, typed arrays, class instances — have a
 * different prototype and are therefore rejected, so `deepMerge` treats them
 * as leaves and replaces verbatim instead of reducing them to `{}` via an
 * empty `Object.keys` recursion.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep merge two objects. Plain objects (prototype `Object.prototype` or
 * `null`) are merged recursively. Arrays, primitives, and any non-plain
 * object (e.g. `Date`, `Map`, `Set`, `RegExp`, class instances) from the
 * source replace the target verbatim — they are leaf values.
 */
export function deepMerge(target: unknown, source: unknown): unknown {
  if (!isPlainObject(source) || !isPlainObject(target)) {
    return source;
  }

  const result = { ...target };
  for (const k of Object.keys(source)) {
    result[k] = deepMerge(result[k], source[k]);
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
