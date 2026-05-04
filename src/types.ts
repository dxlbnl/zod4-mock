import type { ZodTypeAny, ZodObject, ZodRawShape, input } from 'zod'

// ---------------------------------------------------------------------------
// Cardinality & Relations
// ---------------------------------------------------------------------------

export type Cardinality = '0..1' | '1' | '0..n' | '1..n'

export interface RelationDef {
  readonly type: string
  readonly cardinality: Cardinality
}

export type RelationMap = Record<string, RelationDef>

// ---------------------------------------------------------------------------
// SubjectType
// ---------------------------------------------------------------------------

export interface SubjectTypeOptions<TRelations extends RelationMap = RelationMap> {
  readonly relations?: TRelations
}

export interface SubjectType<
  TSchema extends ZodObject<ZodRawShape>,
  TRelations extends RelationMap = RelationMap,
> {
  readonly _tag: 'SubjectType'
  readonly name: string
  readonly schema: TSchema
  readonly relations: TRelations
}

export type AnySubjectType = SubjectType<ZodObject<ZodRawShape>, RelationMap>

// ---------------------------------------------------------------------------
// Subject instances (generated data)
// ---------------------------------------------------------------------------

export type SubjectData<T extends AnySubjectType> = input<T['schema']>

export interface SubjectInstance<T extends AnySubjectType = AnySubjectType> {
  readonly _type: string
  readonly _id: string
  readonly data: SubjectData<T>
}

export type AnySubjectInstance = SubjectInstance<AnySubjectType>

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

export interface Prng {
  /** Returns a float in [0, 1) */
  random(): number
  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number
  /** Returns one element from a non-empty array */
  pick<T>(items: readonly [T, ...T[]]): T
  /** Returns a new PRNG seeded deterministically from this one + a string key */
  fork(key: string): Prng
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface Registry {
  /** Store a generated item under a named type */
  store(type: string, item: unknown): void
  /** All stored items of a given type */
  all(type: string): unknown[]
  /** Pick a random stored item of a given type (throws if none) */
  pick(type: string): unknown
  /** Pick a random stored item matching predicate (throws if none match) */
  pickBy(type: string, predicate: (item: unknown) => boolean): unknown
  /** Filter stored items of one or more types */
  filter(type: string | string[], predicate: (item: unknown) => boolean): unknown[]
  /** Number of stored items of a given type */
  count(type: string): number
}

// ---------------------------------------------------------------------------
// Generator context
// ---------------------------------------------------------------------------

export interface GeneratorContext {
  /** The world-level PRNG, already forked for this field */
  readonly prng: Prng
  /** The subject instance being used for this generation (if any) */
  readonly subject: AnySubjectInstance | undefined
  /** Access to all generated & stored data */
  readonly registry: Registry
  /** Full dot-path of the current field being generated (e.g. "address.street") */
  readonly fieldPath: string
}

// ---------------------------------------------------------------------------
// Matchers: field-level overrides tied to a subject
// ---------------------------------------------------------------------------

export type MatcherFn<TSubjectData, TValue> = (
  subject: TSubjectData,
  ctx: GeneratorContext,
) => TValue

export type Matchers<TSchema extends ZodTypeAny, TSubjectData> = {
  [K in keyof input<TSchema>]?: MatcherFn<TSubjectData, input<TSchema>[K]>
}

// ---------------------------------------------------------------------------
// Deep partial (for overrides)
// ---------------------------------------------------------------------------

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T

// ---------------------------------------------------------------------------
// withSchema registration
// ---------------------------------------------------------------------------

export interface SchemaRegistration<
  TSchema extends ZodTypeAny,
  TSubjectData,
> {
  readonly schema: TSchema
  readonly subjectTypes: string[]
  readonly matchers: Matchers<TSchema, TSubjectData>
}

// ---------------------------------------------------------------------------
// generate() options
// ---------------------------------------------------------------------------

export interface GenerateOptions<T> {
  /** Force a specific subject type when ambiguous */
  readonly subject?: string
  /** Deep-partial overrides applied after generation */
  readonly overrides?: DeepPartial<T>
  /** Transform function applied after overrides */
  readonly transform?: (data: T) => T
}

// ---------------------------------------------------------------------------
// World options
// ---------------------------------------------------------------------------

export interface WorldOptions {
  /** Master seed for deterministic generation */
  readonly seed: number
  /** Probability (0–1) that optional fields are omitted. Default: 0.2 */
  readonly optionalProbability?: number
  /** Default array length range when no Zod constraints are present */
  readonly defaultArrayLength?: readonly [number, number]
}

// ---------------------------------------------------------------------------
// World interface
// ---------------------------------------------------------------------------

export interface World {
  /** Register a subject type definition */
  withSubject(subjectType: AnySubjectType): this

  /** Register an app schema bound to one or more subject types */
  withSchema<TSchema extends ZodTypeAny, TSubjectData>(
    schema: TSchema,
    subjectTypes: string | string[],
    matchers?: Matchers<TSchema, TSubjectData>,
  ): this

  /** Generate a value (or array of values) from a schema */
  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<input<TSchema>>,
  ): input<TSchema>

  /** Get or create a subject instance of the given type */
  subject(type: string): AnySubjectInstance

  /** Access to the subject/data registry */
  readonly registry: Registry
}
