/**
 * @module generators/key-based
 * Generates semantically meaningful values based on field name patterns.
 *
 * Generation pipeline position: higher priority than schema-based, lower than matchers.
 * Returns `undefined` for unrecognised keys so the caller can fall back to schema-based.
 */

import type { ZodTypeAny } from 'zod'
import type { GeneratorContext } from '../types.js'
import { generateFromSchema } from './schema-based.js'

// ---------------------------------------------------------------------------
// Data sets
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Jan', 'Piet', 'Klaas', 'Hans', 'Dirk', 'Erik', 'Tom', 'Sven', 'Luc', 'Bas',
  'Marie', 'Anna', 'Lisa', 'Emma', 'Sara', 'Lena', 'Nora', 'Eva', 'Julia', 'Inge',
  'James', 'John', 'Paul', 'Mark', 'Luke', 'Adam', 'Noah', 'Owen', 'Ryan', 'Sean',
  'Alice', 'Grace', 'Claire', 'Mia', 'Zoe', 'Iris', 'Laura', 'Amy', 'Kate', 'Ruth',
] as const

const LAST_NAMES = [
  'de Vries', 'Janssen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Peters', 'van den Berg',
  'Dekker', 'Vermeer', 'Brouwer', 'Hendriks', 'Kuiper', 'Willems', 'van der Linden',
  'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker',
] as const

const CITIES = [
  'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven',
  'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Tilburg',
  'London', 'Berlin', 'Paris', 'Brussels', 'Vienna',
] as const

const STREETS = [
  'Keizersgracht', 'Prinsengracht', 'Herengracht', 'Singel', 'Overtoom',
  'Dorpsstraat', 'Molenweg', 'Kerkstraat', 'Schoolstraat', 'Parallelweg',
  'Main Street', 'High Street', 'Church Lane', 'Park Road', 'Station Road',
] as const

const COUNTRIES = [
  'Netherlands', 'Germany', 'Belgium', 'France', 'United Kingdom',
  'Austria', 'Switzerland', 'Denmark', 'Sweden', 'Norway',
] as const

const DOMAINS = [
  'example.com', 'test.org', 'demo.nl', 'sample.io', 'mock.dev',
  'acme.com', 'corp.nl', 'enterprise.org', 'startup.io', 'labs.dev',
] as const

const TITLES = [
  'Introduction to', 'Guide to', 'Overview of', 'Analysis of',
  'Report on', 'Review of', 'Study on', 'Notes on',
] as const

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
] as const

// ---------------------------------------------------------------------------
// Primitive generators
// ---------------------------------------------------------------------------

function firstName(prng: GeneratorContext['prng']): string {
  return FIRST_NAMES[prng.int(0, FIRST_NAMES.length - 1)]!
}

function lastName(prng: GeneratorContext['prng']): string {
  return LAST_NAMES[prng.int(0, LAST_NAMES.length - 1)]!
}

function email(prng: GeneratorContext['prng']): string {
  const fn = firstName(prng).toLowerCase().replace(/\s/g, '')
  const ln = lastName(prng).toLowerCase().replace(/[\s']/g, '').replace(/\s/g, '')
  const n = prng.int(1, 99)
  const domain = DOMAINS[prng.int(0, DOMAINS.length - 1)]!
  return `${fn}.${ln}${n}@${domain}`
}

function uuid(prng: GeneratorContext['prng']): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = prng.int(0, 15)
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function phone(prng: GeneratorContext['prng']): string {
  const prefix = prng.pick(['+31', '+44', '+49', '+33', '+32'] as const)
  const number = Array.from({ length: 9 }, () => prng.int(0, 9)).join('')
  return `${prefix} ${number}`
}

function postalCode(prng: GeneratorContext['prng']): string {
  return `${prng.int(1000, 9999)} ${String.fromCharCode(prng.int(65, 90))}${String.fromCharCode(prng.int(65, 90))}`
}

function url(prng: GeneratorContext['prng']): string {
  const domain = DOMAINS[prng.int(0, DOMAINS.length - 1)]!
  const path = LOREM_WORDS[prng.int(0, LOREM_WORDS.length - 1)]!
  return `https://${domain}/${path}`
}

function date(prng: GeneratorContext['prng']): Date {
  const start = new Date('2020-01-01').getTime()
  const end   = new Date('2025-12-31').getTime()
  return new Date(start + prng.random() * (end - start))
}

function loremText(prng: GeneratorContext['prng'], words: number): string {
  return Array.from({ length: words }, () => LOREM_WORDS[prng.int(0, LOREM_WORDS.length - 1)]!).join(' ')
}

// ---------------------------------------------------------------------------
// Helper: check if schema is string-typed
// ---------------------------------------------------------------------------

function isStringSchema(schema: ZodTypeAny): boolean {
  return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type === 'string'
}

function isNumberSchema(schema: ZodTypeAny): boolean {
  return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type === 'number'
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Attempt to generate a semantically meaningful value based on the field name.
 *
 * Returns `undefined` when the key is not recognised — the caller should then
 * fall back to `generateFromSchema`.
 */
export function generateFromKey(
  key: string,
  schema: ZodTypeAny,
  ctx: GeneratorContext,
): unknown {
  const lk = key.toLowerCase()
  const prng = ctx.prng

  // --- Identity fields ---
  if (isStringSchema(schema)) {
    if (lk === 'id' || lk.endsWith('id') || lk.endsWith('uuid')) return uuid(prng)
    if (lk === 'email') return email(prng)
    if (lk === 'firstname' || lk === 'first_name') return firstName(prng)
    if (lk === 'lastname' || lk === 'last_name' || lk === 'surname') return lastName(prng)
    if (lk === 'fullname' || lk === 'full_name') return `${firstName(prng)} ${lastName(prng)}`
    if (lk === 'name' && !lk.includes('file')) return `${firstName(prng)} ${lastName(prng)}`
    if (lk === 'phone' || lk === 'phonenumber' || lk === 'phone_number') return phone(prng)
    if (lk === 'street' || lk === 'streetname' || lk === 'street_name') {
      return `${STREETS[prng.int(0, STREETS.length - 1)]!} ${prng.int(1, 200)}`
    }
    if (lk === 'city') return CITIES[prng.int(0, CITIES.length - 1)]!
    if (lk === 'postalcode' || lk === 'zipcode' || lk === 'postal_code') return postalCode(prng)
    if (lk === 'country') return COUNTRIES[prng.int(0, COUNTRIES.length - 1)]!
    if (lk === 'url' || lk === 'website' || lk === 'homepage') return url(prng)
    if (lk === 'title') return `${TITLES[prng.int(0, TITLES.length - 1)]!} ${LOREM_WORDS[prng.int(0, LOREM_WORDS.length - 1)]!}`
    if (['description', 'bio', 'notes', 'note', 'comment', 'content', 'body', 'text', 'message', 'summary', 'transcript'].includes(lk)) {
      return loremText(prng, prng.int(10, 30))
    }
    if (lk === 'sku') {
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      return `${letters[prng.int(0, letters.length - 1)]!}${letters[prng.int(0, letters.length - 1)]!}-${prng.int(1000, 9999)}`
    }
    if (lk === 'vatnumber' || lk === 'vat_number') {
      return `NL${String(prng.int(100000000, 999999999))}B${String(prng.int(10, 99))}`
    }
  }

  // --- Date fields ---
  if (
    lk === 'createdat' || lk === 'updatedat' || lk === 'deletedat' ||
    lk === 'publishedat' || lk === 'startedat' || lk === 'endedat' ||
    lk === 'issuedat' || lk === 'periodstart' || lk === 'periodend' ||
    lk === 'invoicedate' || lk === 'duedate' ||
    lk.endsWith('at') || lk.endsWith('date') || lk.startsWith('date')
  ) {
    return date(prng)
  }

  // --- Numeric fields ---
  if (isNumberSchema(schema)) {
    if (lk.endsWith('cents') || lk.endsWith('price') || lk.endsWith('amount') || lk === 'total') {
      // Generate via schema-based (respects int/min/max constraints)
      return generateFromSchema(schema, ctx)
    }
    if (lk === 'wordcount' || lk === 'word_count') return prng.int(50, 5000)
    if (lk === 'quantity') return prng.int(1, 100)
    if (lk === 'position') return prng.int(0, 100)
    if (lk === 'count') return prng.int(0, 50)
  }

  return undefined // not recognised — caller falls back to schema-based
}
