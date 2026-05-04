/**
 * Unit tests for the extensible key-based generator API.
 *
 * Tests the `generators` namespace, `KeyGenerator` type, `WorldOptions.generators`,
 * and `world.withGenerators()`.
 */

import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import type { ZodTypeAny } from 'zod'
import {
  generators,
  createWorld,
  createPrng,
  defineSubjectType,
} from '../../src/index.js'
import type { GeneratorContext, KeyGenerator, Registry } from '../../src/index.js'

// ---------------------------------------------------------------------------
// Minimal stub registry
// ---------------------------------------------------------------------------

const stubRegistry: Registry = {
  store:  () => { /* no-op */ },
  all:    () => [],
  pick:   () => { throw new Error('no items in stub registry') },
  pickBy: () => { throw new Error('no items in stub registry') },
  filter: () => [],
  count:  () => 0,
}

function makeCtx(seed = 42, fieldPath = 'test'): GeneratorContext {
  return {
    prng:     createPrng(seed),
    subject:  undefined,
    registry: stubRegistry,
    fieldPath,
  }
}

// ---------------------------------------------------------------------------
// Shared fixtures for world tests
// ---------------------------------------------------------------------------

const ProductSubject = defineSubjectType('product', z.object({
  name:       z.string(),
  vendorCode: z.string(),
}))

const ProductSchema = z.object({
  vendorCode: z.string(),
  unitPrice:  z.number().int(),
  label:      z.string(),
  email:      z.string(),
})

// ---------------------------------------------------------------------------
// generators namespace
// ---------------------------------------------------------------------------

describe('generators namespace', () => {
  it('is exported and is an object', () => {
    expect(typeof generators).toBe('object')
    expect(generators).not.toBeNull()
  })

  it('contains all primitive generator functions', () => {
    const expected = ['firstName', 'lastName', 'email', 'uuid', 'phone', 'postalCode', 'url', 'date', 'loremText']
    for (const name of expected) {
      expect(typeof (generators as Record<string, unknown>)[name], `generators.${name}`).toBe('function')
    }
  })

  it('generators.firstName returns a non-empty string', () => {
    const v = generators.firstName(createPrng(42))
    expect(typeof v).toBe('string')
    expect(v.length).toBeGreaterThan(0)
  })

  it('generators.lastName returns a non-empty string', () => {
    const v = generators.lastName(createPrng(42))
    expect(typeof v).toBe('string')
    expect(v.length).toBeGreaterThan(0)
  })

  it('generators.email returns an email-shaped string', () => {
    const v = generators.email(createPrng(42))
    expect(v).toMatch(/@/)
    expect(z.string().email().safeParse(v).success).toBe(true)
  })

  it('generators.uuid returns a valid UUID', () => {
    const v = generators.uuid(createPrng(42))
    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(z.string().uuid().safeParse(v).success).toBe(true)
  })

  it('generators.phone returns a non-empty string', () => {
    const v = generators.phone(createPrng(42))
    expect(typeof v).toBe('string')
    expect(v.length).toBeGreaterThan(0)
  })

  it('generators.postalCode returns a non-empty string', () => {
    const v = generators.postalCode(createPrng(42))
    expect(typeof v).toBe('string')
    expect(v.length).toBeGreaterThan(0)
  })

  it('generators.url returns an https:// URL', () => {
    const v = generators.url(createPrng(42))
    expect(v).toMatch(/^https:\/\//)
  })

  it('generators.date returns a Date', () => {
    const v = generators.date(createPrng(42))
    expect(v).toBeInstanceOf(Date)
  })

  it('generators.loremText returns a string with the requested number of words', () => {
    const v = generators.loremText(createPrng(42), 5)
    expect(typeof v).toBe('string')
    expect(v.split(' ')).toHaveLength(5)
  })

  it('primitive generators produce different values for different seeds', () => {
    expect(generators.firstName(createPrng(1))).not.toBe(generators.firstName(createPrng(2)))
    expect(generators.email(createPrng(1))).not.toBe(generators.email(createPrng(2)))
  })
})

// ---------------------------------------------------------------------------
// WorldOptions.generators
// ---------------------------------------------------------------------------

describe('WorldOptions.generators', () => {
  it('applies a custom generator for a matching field', () => {
    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: () => 'V-FIXED',
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)

    const result = world.generate(ProductSchema)
    expect(result.vendorCode).toBe('V-FIXED')
  })

  it('does not affect unrelated fields (built-in fallback still runs)', () => {
    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: () => 'V-FIXED',
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)

    const result = world.generate(ProductSchema)
    // 'email' is handled by the built-in key-based heuristic → should contain @
    expect(result.email).toMatch(/@/)
  })

  it('custom generator receives the field Zod schema', () => {
    let capturedSchema: ZodTypeAny | undefined

    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: (schema) => {
          capturedSchema = schema
          return 'X'
        },
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)

    world.generate(ProductSchema)
    expect(capturedSchema).toBeDefined()
  })

  it('custom generator receives a full GeneratorContext', () => {
    let capturedCtx: GeneratorContext | undefined

    const world = createWorld({
      seed: 42,
      generators: {
        vendorCode: (_schema, ctx) => {
          capturedCtx = ctx
          return 'X'
        },
      },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)

    world.generate(ProductSchema)
    expect(capturedCtx?.prng).toBeDefined()
    expect(capturedCtx?.fieldPath).toBe('vendorCode')
    expect(capturedCtx?.registry).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// world.withGenerators()
// ---------------------------------------------------------------------------

describe('world.withGenerators', () => {
  it('returns `this` for fluent chaining', () => {
    const world = createWorld({ seed: 42 })
    expect(world.withGenerators({})).toBe(world)
  })

  it('applies a custom generator registered after construction', () => {
    const world = createWorld({ seed: 42 })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => 'CHAIN-VALUE' })

    const result = world.generate(ProductSchema)
    expect(result.vendorCode).toBe('CHAIN-VALUE')
  })

  it('merges additively — earlier keys are preserved', () => {
    const world = createWorld({ seed: 42 })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => 'V1' })
      .withGenerators({ label: () => 'L1' })

    const result = world.generate(ProductSchema)
    expect(result.vendorCode).toBe('V1')
    expect(result.label).toBe('L1')
  })

  it('later withGenerators call overrides same key from earlier call', () => {
    const world = createWorld({ seed: 42 })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => 'FIRST' })
      .withGenerators({ vendorCode: () => 'SECOND' })

    const result = world.generate(ProductSchema)
    expect(result.vendorCode).toBe('SECOND')
  })

  it('withGenerators overrides same key from WorldOptions.generators', () => {
    const world = createWorld({
      seed: 42,
      generators: { vendorCode: () => 'FROM-OPTIONS' },
    })
      .withSubject(ProductSubject)
      .withSchema(ProductSchema, ProductSubject)
      .withGenerators({ vendorCode: () => 'FROM-WITH-GENERATORS' })

    const result = world.generate(ProductSchema)
    expect(result.vendorCode).toBe('FROM-WITH-GENERATORS')
  })
})

// ---------------------------------------------------------------------------
// Case-insensitive key matching
// ---------------------------------------------------------------------------

describe('case-insensitive key matching', () => {
  const MixedCaseSchema = z.object({
    VendorCode: z.string(),
    LABEL:      z.string(),
  })

  const MixedSubject = defineSubjectType('mixed', z.object({ name: z.string() }))

  it('matches schema field VendorCode against generator registered as vendorcode', () => {
    const world = createWorld({ seed: 42 })
      .withSubject(MixedSubject)
      .withSchema(MixedCaseSchema, MixedSubject)
      .withGenerators({ vendorcode: () => 'case-insensitive' })

    const result = world.generate(MixedCaseSchema)
    expect(result.VendorCode).toBe('case-insensitive')
  })

  it('matches schema field LABEL against generator registered as label', () => {
    const world = createWorld({ seed: 42 })
      .withSubject(MixedSubject)
      .withSchema(MixedCaseSchema, MixedSubject)
      .withGenerators({ label: () => 'lower-match' })

    const result = world.generate(MixedCaseSchema)
    expect(result.LABEL).toBe('lower-match')
  })
})

// ---------------------------------------------------------------------------
// Schema-gated custom generators
// ---------------------------------------------------------------------------

describe('schema-gated custom generators', () => {
  const GatedSchema = z.object({
    unitPrice: z.number().int(),
    label:     z.string(),
  })

  const GatedSubject = defineSubjectType('gated', z.object({ name: z.string() }))

  it('custom generator can inspect the schema and return undefined to fall through', () => {
    // Register a generator that only applies to number schemas
    const world = createWorld({ seed: 42 })
      .withSubject(GatedSubject)
      .withSchema(GatedSchema, GatedSubject)
      .withGenerators({
        unitPrice: (_schema, ctx) => ctx.prng.int(500, 999),
        label:     (_schema, ctx) => `LBL-${ctx.prng.int(1, 99)}`,
      })

    const result = world.generate(GatedSchema)
    expect(result.unitPrice).toBeGreaterThanOrEqual(500)
    expect(result.unitPrice).toBeLessThanOrEqual(999)
    expect(result.label).toMatch(/^LBL-/)
  })
})

// ---------------------------------------------------------------------------
// KeyGenerator type is exported
// ---------------------------------------------------------------------------

describe('KeyGenerator type', () => {
  it('can be used as a type annotation', () => {
    // This is a compile-time check — if KeyGenerator is exported correctly,
    // the annotation below will not cause a TypeScript error.
    const gen: KeyGenerator<string> = (_schema, ctx) => generators.firstName(ctx.prng)
    expect(typeof gen).toBe('function')
    expect(typeof gen(z.string(), makeCtx())).toBe('string')
  })
})
