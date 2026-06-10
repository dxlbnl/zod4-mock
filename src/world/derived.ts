import type { ZodTypeAny } from "zod";

export type DerivedUpsertMap = Map<ZodTypeAny, Map<unknown, unknown>>;

// Identity = source[sourceKey] when a sourceKey is set, else the source reference.
export function computeSourceIdentity(
  sourceKey: string | null | undefined,
  source: unknown,
): unknown {
  if (sourceKey !== null && sourceKey !== undefined) {
    return (source as Record<string, unknown>)[sourceKey];
  }
  return source;
}

export function getDerivedUpsert(
  upsertMap: DerivedUpsertMap,
  schema: ZodTypeAny,
  identity: unknown,
): unknown | undefined {
  return upsertMap.get(schema)?.get(identity);
}

export function setDerivedUpsert(
  upsertMap: DerivedUpsertMap,
  schema: ZodTypeAny,
  identity: unknown,
  result: unknown,
): void {
  let inner = upsertMap.get(schema);
  if (!inner) {
    inner = new Map<unknown, unknown>();
    upsertMap.set(schema, inner);
  }
  inner.set(identity, result);
}
