/**
 * @module generators/schema-based
 * Generates values by introspecting Zod v4 schema definitions.
 *
 * Generation pipeline position: lowest priority (fallback after matchers and key-based).
 */

import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'
import { createPrng } from '../prng.js'

// ---------------------------------------------------------------------------
// Internal types for Zod v4 def introspection
// ---------------------------------------------------------------------------

interface ZodDef {
  type: string
  checks?: ZodCheck[]
  // string
  // number
  // object
  shape?: Record<string, ZodTypeAny>
  // array
  element?: ZodTypeAny
  // enum
  entries?: Record<string, string>
  // literal
  values?: unknown[]
  // optional / nullable / default
  innerType?: ZodTypeAny
  // union
  options?: ZodTypeAny[]
  // pipe / transform
  out?: ZodTypeAny
}

interface ZodCheck {
  check: string
  minimum?: number
  maximum?: number
  length?: number
  value?: number
  inclusive?: boolean
  format?: string
}

function def(schema: ZodTypeAny): ZodDef {
  return (schema as unknown as { _zod: { def: ZodDef } })._zod.def
}

/**
 * Returns the inner `_zod.def` objects for each check on a schema.
 *
 * In Zod v4, each check is a class instance.  The check type and its
 * parameters live in `instance._zod.def`, not as plain own-enumerable
 * properties on the instance itself.
 */
function checks(schema: ZodTypeAny): ZodCheck[] {
  const raw = def(schema).checks as Array<{ _zod: { def: ZodCheck } }> | undefined
  return (raw ?? []).map((c) => c._zod.def)
}

// ---------------------------------------------------------------------------
// UUID generation (RFC 4122 v4)
// ---------------------------------------------------------------------------

function generateUuid(prng: GeneratorContext['prng']): string {
  // Replace template: 'x' → random hex, 'y' → variant bits (8/9/a/b)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = prng.int(0, 15)
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ---------------------------------------------------------------------------
// String generation
// ---------------------------------------------------------------------------

const WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
  'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
  'yankee', 'zulu', 'apple', 'banana', 'cherry', 'data', 'engine', 'frame',
  'graph', 'handle', 'image', 'journey', 'kernel', 'layer', 'module', 'network',
] as const

const DOMAINS = ['example.com', 'test.org', 'demo.nl', 'sample.io', 'mock.dev'] as const

function generateEmail(prng: GeneratorContext['prng']): string {
  const w1 = WORDS[prng.int(0, WORDS.length - 1)]!
  const w2 = WORDS[prng.int(0, WORDS.length - 1)]!
  const n  = prng.int(10, 99)
  const domain = DOMAINS[prng.int(0, DOMAINS.length - 1)]!
  return `${w1}.${w2}${n}@${domain}`
}

function generateString(prng: GeneratorContext['prng'], minLen: number, maxLen: number): string {
  const wordCount = prng.int(1, Math.max(1, Math.floor(maxLen / 5)))
  const words = Array.from({ length: wordCount }, () =>
    WORDS[prng.int(0, WORDS.length - 1)]!,
  )
  let result = words.join(' ')
  // Trim or pad to fit constraints
  if (result.length > maxLen) result = result.slice(0, maxLen)
  if (result.length < minLen) result = result.padEnd(minLen, 'x')
  return result
}

// ---------------------------------------------------------------------------
// Number helpers
// ---------------------------------------------------------------------------

function resolveNumber(schema: ZodTypeAny, prng: GeneratorContext['prng']): number {
  let min = 0
  let max = 1000
  let isInt = false

  for (const c of checks(schema)) {
    if (c.check === 'number_format') {
      // 'safeint' is the format used by z.number().int() in Zod v4
      isInt = c.format === 'safeint' || c.format === 'int'
    }
    if (c.check === 'greater_than') {
      min = c.value! + (c.inclusive ? 0 : 1)
    }
    if (c.check === 'less_than') {
      max = c.value! - (c.inclusive ? 0 : 1)
    }
  }

  if (isInt) return prng.int(Math.ceil(min), Math.floor(max))
  return min + prng.random() * (max - min)
}

// ---------------------------------------------------------------------------
// Array length resolution
// ---------------------------------------------------------------------------

export function resolveArrayLength(
  schema: ZodTypeAny,
  defaultMin: number,
  defaultMax: number,
  prng: GeneratorContext['prng'],
): number {
  let min = defaultMin
  let max = defaultMax
  let exact: number | undefined

  for (const c of checks(schema)) {
    if (c.check === 'length_equals') exact = c.length!
    if (c.check === 'min_length') min = Math.max(min, c.minimum!)
    if (c.check === 'max_length') max = Math.min(max, c.maximum!)
  }

  if (exact !== undefined) return exact
  return prng.int(Math.min(min, max), Math.max(min, max))
}

// ---------------------------------------------------------------------------
// String format resolution
// ---------------------------------------------------------------------------

function resolveStringFormat(schema: ZodTypeAny): string | undefined {
  for (const c of checks(schema)) {
    if (c.check === 'string_format' && c.format) return c.format
  }
  return undefined
}

function resolveStringLength(schema: ZodTypeAny): { min: number; max: number } {
  let min = 3
  let max = 40
  for (const c of checks(schema)) {
    if (c.check === 'min_length') min = Math.max(min, c.minimum!)
    if (c.check === 'max_length') max = Math.min(max, c.maximum!)
  }
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

/**
 * Generate a value from `schema` using Zod v4 type introspection.
 *
 * @param schema - Any Zod schema.
 * @param ctx    - Generation context (PRNG, subject, registry).
 * @returns A value that satisfies `schema`.
 */
export function generateFromSchema(schema: ZodTypeAny, ctx: GeneratorContext): unknown {
  const d = def(schema)
  const prng = ctx.prng
  const optProb = ctx.optionalProbability ?? 0.2

  switch (d.type) {
    case 'string': {
      const format = resolveStringFormat(schema)
      if (format === 'email') return generateEmail(prng)
      if (format === 'uuid')  return generateUuid(prng)
      if (format === 'url')   return `https://example.com/${generateString(prng, 3, 10).replace(/ /g, '-')}`
      const { min, max } = resolveStringLength(schema)
      return generateString(prng, min, max)
    }

    case 'number': {
      return resolveNumber(schema, prng)
    }

    case 'boolean': {
      return prng.random() > 0.5
    }

    case 'date': {
      // Random date between 2020-01-01 and 2025-12-31
      const start = new Date('2020-01-01').getTime()
      const end   = new Date('2025-12-31').getTime()
      return new Date(start + prng.random() * (end - start))
    }

    case 'enum': {
      const keys = Object.keys(d.entries!)
      return d.entries![keys[prng.int(0, keys.length - 1)]!]
    }

    case 'literal': {
      return d.values![0]
    }

    case 'object': {
      const shape = d.shape!
      const result: Record<string, unknown> = {}
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const childCtx: GeneratorContext = {
          ...ctx,
          prng: ctx.prng.fork(key),
          fieldPath: ctx.fieldPath ? `${ctx.fieldPath}.${key}` : key,
        }
        result[key] = generateFromSchema(fieldSchema, childCtx)
      }
      return result
    }

    case 'array': {
      const [defMin, defMax] = [1, 5]
      const length = resolveArrayLength(schema, defMin, defMax, prng)
      return Array.from({ length }, (_, i) =>
        generateFromSchema(d.element!, {
          ...ctx,
          prng: ctx.prng.fork(`[${i}]`),
          fieldPath: `${ctx.fieldPath}[${i}]`,
        }),
      )
    }

    case 'optional': {
      if (prng.random() < optProb) return undefined
      return generateFromSchema(d.innerType!, ctx)
    }

    case 'nullable': {
      if (prng.random() < optProb) return null
      return generateFromSchema(d.innerType!, ctx)
    }

    case 'union': {
      const options = d.options!
      const chosen = options[prng.int(0, options.length - 1)]!
      return generateFromSchema(chosen, ctx)
    }

    case 'default': {
      return generateFromSchema(d.innerType!, ctx)
    }

    case 'pipe': {
      // Generate the input type (first schema in the pipe); ignore the transform
      const pipeIn = (d as unknown as { in: ZodTypeAny }).in
      return pipeIn ? generateFromSchema(pipeIn, ctx) : generateString(prng, 3, 20)
    }

    case 'null':      return null
    case 'undefined': return undefined
    case 'void':      return undefined
    case 'any':
    case 'unknown':   return generateString(prng, 3, 10)

    default: {
      // Best-effort: return a string
      return generateString(prng, 3, 10)
    }
  }
}
