/**
 * Unit tests for the low-level generator functions.
 *
 * These test `generateFromSchema` and `generateFromKey` in isolation, without
 * a full world.  A minimal `GeneratorContext` is constructed inline.
 *
 * All tests will fail with "not implemented" until fase 3.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { generateFromSchema, generateFromKey, createPrng } from '../../src/index.js'
import type { GeneratorContext, Registry } from '../../src/index.js'

// ---------------------------------------------------------------------------
// Minimal stub registry for isolated generator tests
// ---------------------------------------------------------------------------

const stubRegistry: Registry = {
  store: () => { /* no-op */ },
  all:   () => [],
  pick:  () => { throw new Error('no items in stub registry') },
  pickBy: () => { throw new Error('no items in stub registry') },
  filter: () => [],
  count:  () => 0,
}

function makeCtx(seed = 42, fieldPath = 'test'): GeneratorContext {
  return {
    prng:      createPrng(seed),
    subject:   undefined,
    registry:  stubRegistry,
    fieldPath,
  }
}

// ---------------------------------------------------------------------------
// generateFromSchema — primitive types
// ---------------------------------------------------------------------------

describe('generateFromSchema — primitives', () => {
  it('generates a string for z.string()', () => {
    expect(typeof generateFromSchema(z.string(), makeCtx())).toBe('string')
  })

  it('generates a number for z.number()', () => {
    expect(typeof generateFromSchema(z.number(), makeCtx())).toBe('number')
  })

  it('generates a boolean for z.boolean()', () => {
    expect(typeof generateFromSchema(z.boolean(), makeCtx())).toBe('boolean')
  })

  it('generates a Date for z.date()', () => {
    expect(generateFromSchema(z.date(), makeCtx())).toBeInstanceOf(Date)
  })

  it('generates a valid integer within range for z.number().int().min().max()', () => {
    const schema = z.number().int().min(5).max(10)
    const v = generateFromSchema(schema, makeCtx()) as number
    expect(Number.isInteger(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(5)
    expect(v).toBeLessThanOrEqual(10)
  })

  it('stays within range over many calls', () => {
    const schema = z.number().int().min(0).max(100)
    for (let i = 0; i < 100; i++) {
      const v = generateFromSchema(schema, makeCtx(i)) as number
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })
})

// ---------------------------------------------------------------------------
// generateFromSchema — string formats
// ---------------------------------------------------------------------------

describe('generateFromSchema — string formats', () => {
  it('generates a valid email for z.string().email()', () => {
    const v = generateFromSchema(z.string().email(), makeCtx()) as string
    expect(v).toMatch(/@/)
    expect(z.string().email().safeParse(v).success).toBe(true)
  })

  it('generates a valid UUID for z.string().uuid()', () => {
    const v = generateFromSchema(z.string().uuid(), makeCtx()) as string
    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(z.string().uuid().safeParse(v).success).toBe(true)
  })

  it('generates a string respecting .min() length', () => {
    const schema = z.string().min(10)
    const v = generateFromSchema(schema, makeCtx()) as string
    expect(v.length).toBeGreaterThanOrEqual(10)
  })

  it('generates a string respecting .max() length', () => {
    const schema = z.string().max(5)
    const v = generateFromSchema(schema, makeCtx()) as string
    expect(v.length).toBeLessThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// generateFromSchema — composite types
// ---------------------------------------------------------------------------

describe('generateFromSchema — composite types', () => {
  it('generates a member of z.enum()', () => {
    const schema = z.enum(['a', 'b', 'c'])
    for (let i = 0; i < 30; i++) {
      const v = generateFromSchema(schema, makeCtx(i))
      expect(['a', 'b', 'c']).toContain(v)
    }
  })

  it('generates all fields of z.object()', () => {
    const schema = z.object({ name: z.string(), age: z.number() })
    const v = generateFromSchema(schema, makeCtx()) as { name: string; age: number }
    expect(typeof v.name).toBe('string')
    expect(typeof v.age).toBe('number')
  })

  it('generates an array for z.array()', () => {
    const v = generateFromSchema(z.array(z.string()), makeCtx())
    expect(Array.isArray(v)).toBe(true)
  })

  it('z.array().length(n) generates exactly n items', () => {
    const v = generateFromSchema(z.array(z.string()).length(4), makeCtx()) as unknown[]
    expect(v).toHaveLength(4)
  })

  it('generates a value for z.literal()', () => {
    expect(generateFromSchema(z.literal('hello'), makeCtx())).toBe('hello')
    expect(generateFromSchema(z.literal(42), makeCtx())).toBe(42)
    expect(generateFromSchema(z.literal(true), makeCtx())).toBe(true)
  })

  it('generates null or a value for z.nullable()', () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      generateFromSchema(z.nullable(z.string()), makeCtx(i)),
    )
    expect(results.some(r => r === null)).toBe(true)
    expect(results.some(r => typeof r === 'string')).toBe(true)
  })

  it('generates undefined or a value for z.optional()', () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      generateFromSchema(z.optional(z.string()), makeCtx(i)),
    )
    expect(results.some(r => r === undefined)).toBe(true)
    expect(results.some(r => typeof r === 'string')).toBe(true)
  })

  it('generates a nested object recursively', () => {
    const schema = z.object({
      name:    z.string(),
      address: z.object({
        street: z.string(),
        city:   z.string(),
      }),
    })
    const v = generateFromSchema(schema, makeCtx()) as {
      name: string
      address: { street: string; city: string }
    }
    expect(typeof v.name).toBe('string')
    expect(typeof v.address.street).toBe('string')
    expect(typeof v.address.city).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// generateFromKey — key-based generators
// ---------------------------------------------------------------------------

describe('generateFromKey', () => {
  it('does not throw for an unrecognised key', () => {
    expect(() => generateFromKey('zzz_unknown_field_xyz', z.string(), makeCtx())).not.toThrow()
  })

  it('generates a non-empty string for key "firstName"', () => {
    const v = generateFromKey('firstName', z.string(), makeCtx())
    expect(typeof v).toBe('string')
    expect((v as string).length).toBeGreaterThan(0)
  })

  it('generates a non-empty string for key "lastName"', () => {
    const v = generateFromKey('lastName', z.string(), makeCtx())
    expect(typeof v).toBe('string')
    expect((v as string).length).toBeGreaterThan(0)
  })

  it('generates an email-shaped string for key "email"', () => {
    const v = generateFromKey('email', z.string(), makeCtx())
    expect(typeof v).toBe('string')
    expect(v as string).toMatch(/@/)
  })

  it('generates a valid email for key "email"', () => {
    const v = generateFromKey('email', z.string(), makeCtx())
    expect(z.string().email().safeParse(v).success).toBe(true)
  })

  it('generates a UUID-shaped value for key "id"', () => {
    const v = generateFromKey('id', z.string().uuid(), makeCtx())
    expect(z.string().uuid().safeParse(v).success).toBe(true)
  })

  it('generates a UUID-shaped value for keys ending in "Id"', () => {
    const v = generateFromKey('userId', z.string().uuid(), makeCtx())
    expect(z.string().uuid().safeParse(v).success).toBe(true)
  })

  it('generates different values for different seeds', () => {
    const a = generateFromKey('firstName', z.string(), makeCtx(1))
    const b = generateFromKey('firstName', z.string(), makeCtx(2))
    expect(a).not.toBe(b)
  })
})
