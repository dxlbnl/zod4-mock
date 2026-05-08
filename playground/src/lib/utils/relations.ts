import type { RelationshipDef, SubjectDef } from "../state.svelte";

/**
 * Finds a relationship that matches a field key based on naming heuristics.
 * Patterns: relationName, relationName + "Id", relationName + "_id", targetType + "Id", targetType + "_id".
 * This mirrors the core library's internal heuristics for UI feedback purposes.
 */
export function findMatchingRelation(
  fieldKey: string,
  relations: RelationshipDef[],
  subjects: SubjectDef[],
): RelationshipDef | undefined {
  if (!fieldKey) return undefined;
  const key = fieldKey.toLowerCase();

  return relations.find((rel) => {
    const targetSubj = subjects.find((s) => s.name === rel.to);
    const possibleKeys = [
      rel.relationName,
      rel.relationName + "Id",
      rel.relationName + "_id",
      (targetSubj?.name || "") + "Id",
      (targetSubj?.name || "") + "_id",
    ].map((k) => k.toLowerCase());

    return possibleKeys.includes(key);
  });
}
