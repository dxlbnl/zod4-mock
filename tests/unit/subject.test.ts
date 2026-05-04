/**
 * Unit tests for `defineSubjectType`.
 *
 * `defineSubjectType` is fully implemented in fase 1 (it just constructs an
 * object), so all tests here pass immediately and serve as regression guards.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineSubjectType } from '../../src/index.js'

const PersonSchema = z.object({
  firstName: z.string(),
  lastName:  z.string(),
  age:       z.number().int().min(18).max(90),
  email:     z.string().email(),
})

const CompanySchema = z.object({
  name:   z.string(),
  kvk:    z.string().regex(/^\d{8}$/),
  sector: z.enum(['tech', 'finance', 'retail']),
})

describe('defineSubjectType', () => {
  it('returns an object with _tag "SubjectType"', () => {
    const PersonSubject = defineSubjectType('person', PersonSchema)
    expect(PersonSubject._tag).toBe('SubjectType')
  })

  it('stores the provided name', () => {
    const PersonSubject = defineSubjectType('person', PersonSchema)
    expect(PersonSubject.name).toBe('person')
  })

  it('stores the provided schema by reference', () => {
    const PersonSubject = defineSubjectType('person', PersonSchema)
    expect(PersonSubject.schema).toBe(PersonSchema)
  })

  it('relations default to an empty object when omitted', () => {
    const PersonSubject = defineSubjectType('person', PersonSchema)
    expect(PersonSubject.relations).toEqual({})
  })

  it('stores provided relation definitions verbatim', () => {
    const PersonSubject = defineSubjectType('person', PersonSchema, {
      relations: {
        partner:  { type: 'person',  cardinality: '0..1' },
        children: { type: 'person',  cardinality: '0..n' },
        employer: { type: 'company', cardinality: '0..1' },
      },
    })

    expect(PersonSubject.relations['partner']).toEqual({ type: 'person', cardinality: '0..1' })
    expect(PersonSubject.relations['children']).toEqual({ type: 'person', cardinality: '0..n' })
    expect(PersonSubject.relations['employer']).toEqual({ type: 'company', cardinality: '0..1' })
  })

  it('supports all four cardinality values', () => {
    const SubjectWithAll = defineSubjectType('thing', z.object({ id: z.string() }), {
      relations: {
        a: { type: 'other', cardinality: '0..1' },
        b: { type: 'other', cardinality: '1'    },
        c: { type: 'other', cardinality: '0..n' },
        d: { type: 'other', cardinality: '1..n' },
      },
    })

    expect(SubjectWithAll.relations['a']?.cardinality).toBe('0..1')
    expect(SubjectWithAll.relations['b']?.cardinality).toBe('1')
    expect(SubjectWithAll.relations['c']?.cardinality).toBe('0..n')
    expect(SubjectWithAll.relations['d']?.cardinality).toBe('1..n')
  })

  it('two subject types with the same schema are independent objects', () => {
    const A = defineSubjectType('type-a', PersonSchema)
    const B = defineSubjectType('type-b', PersonSchema)
    expect(A).not.toBe(B)
    expect(A.name).toBe('type-a')
    expect(B.name).toBe('type-b')
  })

  it('different schema shapes are preserved', () => {
    const CompanySubject = defineSubjectType('company', CompanySchema)
    expect(CompanySubject.schema).toBe(CompanySchema)
    expect(CompanySubject.name).toBe('company')
  })
})
