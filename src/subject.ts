import type { ZodObject, ZodRawShape } from 'zod'
import type { AnySubjectType, RelationMap, SubjectTypeOptions } from './types.js'

export function defineSubjectType<
  TSchema extends ZodObject<ZodRawShape>,
  TRelations extends RelationMap = Record<never, never>,
>(
  name: string,
  schema: TSchema,
  options?: SubjectTypeOptions<TRelations>,
): AnySubjectType & { schema: TSchema; relations: TRelations } {
  return {
    _tag: 'SubjectType',
    name,
    schema,
    relations: (options?.relations ?? {}) as TRelations,
  }
}
