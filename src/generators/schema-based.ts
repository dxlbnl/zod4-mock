/**
 * @module generators/schema-based
 * Generates values by introspecting Zod v4 schema definitions.
 *
 * Generation pipeline position: lowest priority (fallback after matchers and key-based).
 */

import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'

// ---------------------------------------------------------------------------
// Internal types for Zod v4 def introspection
// ---------------------------------------------------------------------------

interface ZodDef {
  type: string
  // Top-level format schemas: z.int(), z.iso.date(), z.cuid(), etc.
  check?: string
  format?: string
  // object
  shape?: Record<string, ZodTypeAny>
  // array
  element?: ZodTypeAny
  // enum
  entries?: Record<string, string>
  // literal
  values?: unknown[]
  // optional / nullable / default / catch / readonly / promise
  innerType?: ZodTypeAny
  // union / discriminatedUnion
  options?: ZodTypeAny[]
  // pipe
  in?: ZodTypeAny
  // tuple
  items?: ZodTypeAny[]
  rest?: ZodTypeAny
  // record / map
  keyType?: ZodTypeAny
  valueType?: ZodTypeAny
  // intersection
  left?: ZodTypeAny
  right?: ZodTypeAny
  // lazy
  getter?: () => ZodTypeAny
  // checks array
  checks?: ZodCheck[]
}

interface ZodCheck {
  check: string
  minimum?: number
  maximum?: number
  length?: number
  value?: unknown        // number | bigint | Date
  inclusive?: boolean
  format?: string
  prefix?: string        // starts_with
  suffix?: string        // ends_with
  includes?: string      // includes
  pattern?: RegExp       // regex
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
// String format generators
// ---------------------------------------------------------------------------

const LOWERCASE_ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789'
const URL_SAFE           = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const CROCKFORD_BASE32   = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const BASE64_CHARS       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64URL_CHARS    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const EMOJIS             = ['😀', '😁', '😂', '🎉', '🔥', '✨', '🌟', '🎯', '🚀', '💡'] as const

function randomFrom(chars: string, len: number, prng: GeneratorContext['prng']): string {
  return Array.from({ length: len }, () => chars[prng.int(0, chars.length - 1)]!).join('')
}

function generateCuid(prng: GeneratorContext['prng']): string {
  return 'c' + randomFrom(LOWERCASE_ALPHANUM, 24, prng)
}

function generateCuid2(prng: GeneratorContext['prng']): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return letters[prng.int(0, letters.length - 1)]! + randomFrom(LOWERCASE_ALPHANUM, 23, prng)
}

function generateUlid(prng: GeneratorContext['prng']): string {
  return randomFrom(CROCKFORD_BASE32, 26, prng)
}

function generateNanoid(prng: GeneratorContext['prng']): string {
  return randomFrom(URL_SAFE, 21, prng)
}

function generateBase64(prng: GeneratorContext['prng']): string {
  // Generate groups of 3 bytes → 4 base64 chars (avoids padding edge cases)
  const groups = prng.int(2, 5)
  let result = ''
  for (let i = 0; i < groups; i++) {
    const a = prng.int(0, 255)
    const b = prng.int(0, 255)
    const c = prng.int(0, 255)
    result += BASE64_CHARS[(a >> 2) & 63]!
    result += BASE64_CHARS[((a & 3) << 4) | ((b >> 4) & 15)]!
    result += BASE64_CHARS[((b & 15) << 2) | ((c >> 6) & 3)]!
    result += BASE64_CHARS[c & 63]!
  }
  return result
}

function generateBase64url(prng: GeneratorContext['prng']): string {
  const groups = prng.int(2, 5)
  let result = ''
  for (let i = 0; i < groups; i++) {
    const a = prng.int(0, 255)
    const b = prng.int(0, 255)
    const c = prng.int(0, 255)
    result += BASE64URL_CHARS[(a >> 2) & 63]!
    result += BASE64URL_CHARS[((a & 3) << 4) | ((b >> 4) & 15)]!
    result += BASE64URL_CHARS[((b & 15) << 2) | ((c >> 6) & 3)]!
    result += BASE64URL_CHARS[c & 63]!
  }
  return result
}

function generateJwt(prng: GeneratorContext['prng']): string {
  // Fixed valid JWT header; payload and signature are random base64url
  const header  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
  const payload = generateBase64url(prng.fork('jwt-p'))
  const sig     = generateBase64url(prng.fork('jwt-s'))
  return `${header}.${payload}.${sig}`
}

function generateEmoji(prng: GeneratorContext['prng']): string {
  return EMOJIS[prng.int(0, EMOJIS.length - 1)]!
}

function generateE164(prng: GeneratorContext['prng']): string {
  const country = prng.int(1, 9)
  const number  = randomFrom('0123456789', 10, prng)
  return `+${country}${number}`
}

function generateCidrv4(prng: GeneratorContext['prng']): string {
  const a      = prng.int(1, 254)
  const b      = prng.int(0, 255)
  const c      = prng.int(0, 255)
  const prefix = prng.int(0, 32)
  return `${a}.${b}.${c}.0/${prefix}`
}

function generateCidrv6(prng: GeneratorContext['prng']): string {
  const hex    = (): string => prng.int(0, 0xffff).toString(16).padStart(4, '0')
  const prefix = prng.int(0, 128)
  return `${hex()}:${hex()}::/${prefix}`
}

function pad2(n: number): string { return String(n).padStart(2, '0') }
function pad4(n: number): string { return String(n).padStart(4, '0') }

function generateIsoDate(prng: GeneratorContext['prng']): string {
  const year  = prng.int(2020, 2025)
  const month = prng.int(1, 12)
  const day   = prng.int(1, 28)
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`
}

function generateIsoTime(prng: GeneratorContext['prng']): string {
  return `${pad2(prng.int(0, 23))}:${pad2(prng.int(0, 59))}:${pad2(prng.int(0, 59))}`
}

function generateIsoDatetime(prng: GeneratorContext['prng']): string {
  return `${generateIsoDate(prng)}T${generateIsoTime(prng)}Z`
}

function generateIsoDuration(prng: GeneratorContext['prng']): string {
  return `P${prng.int(0, 5)}Y${prng.int(0, 11)}M${prng.int(1, 28)}D`
}

function generateHostname(prng: GeneratorContext['prng']): string {
  const w   = WORDS[prng.int(0, WORDS.length - 1)]!
  const tld = ['com', 'org', 'net', 'io', 'dev'][prng.int(0, 4)]!
  return `${w}.${tld}`
}

function generateStringMatchingRegex(
  prng: GeneratorContext['prng'],
  pattern: RegExp | undefined,
): string {
  if (!pattern) return generateString(prng, 3, 10)
  // Handle simple digit-only patterns like /^\d{N}$/
  const digitMatch = pattern.source.match(/^\^\\d\{(\d+)\}\$$/)
  if (digitMatch) return randomFrom('0123456789', parseInt(digitMatch[1]!, 10), prng)
  // Use a literal prefix from an anchored pattern /^literal.../
  const literalMatch = pattern.source.match(/^\^([a-zA-Z0-9_-]{1,20})/)
  if (literalMatch) {
    const candidate = literalMatch[1]!
    if (pattern.test(candidate)) return candidate
  }
  // Try existing words as a fallback
  for (const word of WORDS) {
    if (pattern.test(word)) return word
  }
  return generateString(prng, 3, 10)
}

// ---------------------------------------------------------------------------
// Number helpers
// ---------------------------------------------------------------------------

function resolveNumber(schema: ZodTypeAny, prng: GeneratorContext['prng']): number {
  const d = def(schema)
  let min = -1000
  let max = 1000
  let hasMin = false
  let hasMax = false
  let isInt = false
  let multipleOf: number | undefined

  // z.int() / z.int32() store format at the top-level def (not in checks[])
  if (d.check === 'number_format') {
    isInt = d.format === 'safeint' || d.format === 'int32'
  }

  for (const c of checks(schema)) {
    if (c.check === 'number_format') {
      isInt = c.format === 'safeint' || c.format === 'int' || c.format === 'int32'
    }
    if (c.check === 'greater_than') {
      min = (c.value as number) + (c.inclusive ? 0 : 1)
      hasMin = true
    }
    if (c.check === 'less_than') {
      max = (c.value as number) - (c.inclusive ? 0 : 1)
      hasMax = true
    }
    if (c.check === 'multiple_of') {
      multipleOf = c.value as number
    }
  }

  // When only one bound is set, keep the other side open at a sensible default
  if (hasMin && !hasMax) max = min + 2000
  if (hasMax && !hasMin) min = max - 2000

  if (multipleOf !== undefined) {
    const base  = Math.ceil(min / multipleOf) * multipleOf
    const count = Math.floor((max - base) / multipleOf)
    return base + prng.int(0, Math.max(0, count)) * multipleOf
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
// String format / length resolution
// ---------------------------------------------------------------------------

function resolveStringFormat(schema: ZodTypeAny): string | undefined {
  const d = def(schema)
  // Top-level format: z.iso.date(), z.cuid(), z.nanoid(), etc.
  if (d.check === 'string_format' && d.format) return d.format
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
// BigInt helpers
// ---------------------------------------------------------------------------

function resolveBigInt(schema: ZodTypeAny, prng: GeneratorContext['prng']): bigint {
  let min = BigInt(0)
  let max = BigInt(1000)

  for (const c of checks(schema)) {
    if (c.check === 'greater_than') {
      const v = c.value as bigint
      min = c.inclusive ? v : v + BigInt(1)
    }
    if (c.check === 'less_than') {
      const v = c.value as bigint
      max = c.inclusive ? v : v - BigInt(1)
    }
  }

  const range = max - min
  if (range <= BigInt(0)) return min
  const cap = range > BigInt(1_000_000) ? BigInt(1_000_000) : range
  return min + BigInt(prng.int(0, Number(cap)))
}

// ---------------------------------------------------------------------------
// Set size resolution
// ---------------------------------------------------------------------------

function resolveSetSize(schema: ZodTypeAny, prng: GeneratorContext['prng']): number {
  let min = 1
  let max = 4
  for (const c of checks(schema)) {
    if (c.check === 'min_size') min = Math.max(min, c.minimum!)
    if (c.check === 'max_size') max = Math.min(max, c.maximum!)
  }
  return prng.int(Math.min(min, max), Math.max(min, max))
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
      if (format === 'email')     return generateEmail(prng)
      if (format === 'uuid')      return generateUuid(prng)
      if (format === 'url')       return `https://${generateHostname(prng)}/${generateString(prng, 3, 10).replace(/ /g, '-')}`
      if (format === 'cuid')      return generateCuid(prng)
      if (format === 'cuid2')     return generateCuid2(prng)
      if (format === 'ulid')      return generateUlid(prng)
      if (format === 'nanoid')    return generateNanoid(prng)
      if (format === 'base64')    return generateBase64(prng)
      if (format === 'base64url') return generateBase64url(prng)
      if (format === 'jwt')       return generateJwt(prng)
      if (format === 'emoji')     return generateEmoji(prng)
      if (format === 'e164')      return generateE164(prng)
      if (format === 'cidrv4')    return generateCidrv4(prng)
      if (format === 'cidrv6')    return generateCidrv6(prng)
      if (format === 'date')      return generateIsoDate(prng)
      if (format === 'time')      return generateIsoTime(prng)
      if (format === 'datetime')  return generateIsoDatetime(prng)
      if (format === 'duration')  return generateIsoDuration(prng)
      if (format === 'hostname')  return generateHostname(prng)

      // Positional string constraints (.startsWith, .endsWith, .includes, .regex)
      for (const c of checks(schema)) {
        if (c.check !== 'string_format') continue
        if (c.format === 'starts_with') return (c.prefix ?? '') + generateString(prng, 0, 8)
        if (c.format === 'ends_with')   return generateString(prng, 0, 8) + (c.suffix ?? '')
        if (c.format === 'includes')    return generateString(prng, 0, 4) + (c.includes ?? '') + generateString(prng, 0, 4)
        if (c.format === 'regex')       return generateStringMatchingRegex(prng, c.pattern)
      }

      const { min, max } = resolveStringLength(schema)
      return generateString(prng, min, max)
    }

    case 'number': {
      return resolveNumber(schema, prng)
    }

    case 'boolean': {
      return prng.random() > 0.5
    }

    case 'bigint': {
      return resolveBigInt(schema, prng)
    }

    case 'symbol': {
      return Symbol()
    }

    case 'nan': {
      return NaN
    }

    case 'never': {
      return undefined
    }

    case 'date': {
      let minMs = new Date('2020-01-01').getTime()
      let maxMs = new Date('2025-12-31').getTime()
      for (const c of checks(schema)) {
        if (c.check === 'greater_than') {
          minMs = (c.value as Date).getTime() + (c.inclusive ? 0 : 1)
        }
        if (c.check === 'less_than') {
          maxMs = (c.value as Date).getTime() - (c.inclusive ? 0 : 1)
        }
      }
      return new Date(minMs + prng.random() * (maxMs - minMs))
    }

    case 'enum': {
      const keys = Object.keys(d.entries!)
      return d.entries![keys[prng.int(0, keys.length - 1)]!]
    }

    case 'literal': {
      return d.values![0]
    }

    case 'tuple': {
      const items  = d.items ?? []
      const result = items.map((item, i) =>
        generateFromSchema(item, { ...ctx, prng: ctx.prng.fork(`t-${i}`) }),
      )
      if (d.rest) {
        const restCount = prng.int(0, 3)
        for (let i = 0; i < restCount; i++) {
          result.push(generateFromSchema(d.rest, { ...ctx, prng: ctx.prng.fork(`tr-${i}`) }))
        }
      }
      return result
    }

    case 'record': {
      const count  = prng.int(2, 5)
      const result: Record<string, unknown> = {}
      for (let i = 0; i < count; i++) {
        const key = generateFromSchema(d.keyType!, { ...ctx, prng: ctx.prng.fork(`rk-${i}`) })
        result[String(key)] = generateFromSchema(d.valueType!, { ...ctx, prng: ctx.prng.fork(`rv-${i}`) })
      }
      return result
    }

    case 'map': {
      const count  = prng.int(2, 4)
      const result = new Map<unknown, unknown>()
      for (let i = 0; i < count; i++) {
        const key = generateFromSchema(d.keyType!, { ...ctx, prng: ctx.prng.fork(`mk-${i}`) })
        const val = generateFromSchema(d.valueType!, { ...ctx, prng: ctx.prng.fork(`mv-${i}`) })
        result.set(key, val)
      }
      return result
    }

    case 'set': {
      const size   = resolveSetSize(schema, prng)
      const result = new Set<unknown>()
      for (let i = 0; i < size; i++) {
        result.add(generateFromSchema(d.valueType!, { ...ctx, prng: ctx.prng.fork(`sv-${i}`) }))
      }
      return result
    }

    case 'object': {
      const shape  = d.shape!
      const result: Record<string, unknown> = {}
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const childCtx: GeneratorContext = {
          ...ctx,
          prng:      ctx.prng.fork(key),
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
          prng:      ctx.prng.fork(`el-${i}`),
          fieldPath: `${ctx.fieldPath}[${i}]`,
        }),
      )
    }

    case 'intersection': {
      const left  = generateFromSchema(d.left!, ctx) as Record<string, unknown>
      const right = generateFromSchema(d.right!, { ...ctx, prng: ctx.prng.fork('right') }) as Record<string, unknown>
      return { ...left, ...right }
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
      const chosen  = options[prng.int(0, options.length - 1)]!
      return generateFromSchema(chosen, ctx)
    }

    case 'default': {
      return generateFromSchema(d.innerType!, ctx)
    }

    case 'catch': {
      return generateFromSchema(d.innerType!, ctx)
    }

    case 'readonly': {
      return generateFromSchema(d.innerType!, ctx)
    }

    case 'lazy': {
      // Guard against infinite recursion via field-path depth
      const depth = (ctx.fieldPath ?? '').split('.').length
      if (depth > 5) return null
      return generateFromSchema(d.getter!(), ctx)
    }

    case 'promise': {
      return undefined
    }

    case 'pipe': {
      // Generate the input type; ignore the transform
      const pipeIn = d.in
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
