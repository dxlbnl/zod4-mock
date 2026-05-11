import type { SchemaDef, SchemaRelation } from "../state.svelte";

/**
 * Finds a relationship that matches a field key based on naming heuristics.
 * This mirrors the core library's internal heuristics for UI feedback purposes.
 */
export function findMatchingRelation(
  fieldKey: string,
  relations: SchemaRelation[],
  schemas: SchemaDef[],
): SchemaRelation | undefined {
  if (!fieldKey) return undefined;
  const key = fieldKey.toLowerCase();

  return relations.find((rel) => {
    const target = schemas.find((s) => s.id === rel.targetSchemaId);
    const possibleKeys = [
      rel.name,
      rel.name + "Id",
      rel.name + "_id",
      (target?.name || "") + "Id",
      (target?.name || "") + "_id",
    ].map((k) => k.toLowerCase());

    return possibleKeys.includes(key);
  });
}
