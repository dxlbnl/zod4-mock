import type { ZodTypeAny, input } from 'zod'
import type {
  World,
  WorldOptions,
  AnySubjectType,
  AnySubjectInstance,
  Matchers,
  GenerateOptions,
  Registry,
} from './types.js'
import { SubjectRegistry } from './registry.js'
import { createPrng } from './prng.js'

export class WorldImpl implements World {
  private readonly prng: ReturnType<typeof createPrng>
  readonly registry: Registry

  constructor(private readonly options: WorldOptions) {
    this.prng = createPrng(options.seed)
    this.registry = new SubjectRegistry(this.prng.fork('registry'))
  }

  withSubject(subjectType: AnySubjectType): this {
    throw new Error('not implemented')
  }

  withSchema<TSchema extends ZodTypeAny, TSubjectData>(
    schema: TSchema,
    subjectTypes: string | string[],
    matchers?: Matchers<TSchema, TSubjectData>,
  ): this {
    throw new Error('not implemented')
  }

  generate<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: GenerateOptions<input<TSchema>>,
  ): input<TSchema> {
    throw new Error('not implemented')
  }

  subject(type: string): AnySubjectInstance {
    throw new Error('not implemented')
  }
}

export function createWorld(options: WorldOptions): World {
  return new WorldImpl(options)
}
