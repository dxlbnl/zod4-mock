/**
 * World setup for the invoicing integration test.
 *
 * Demonstrates:
 * - Multiple subject types in a single world (customers + products)
 * - Computed fields (totalCents derived from line items)
 * - Cross-referencing stored subjects from registry within matchers
 */

import { createWorld, defineSubjectType } from '../../../src/index.js'
import type { Prng } from '../../../src/index.js'
import {
  CustomerSubjectSchema,
  ProductSubjectSchema,
  InvoiceSchema,
  CustomerSummarySchema,
} from './schemas.js'

export const CustomerSubject = defineSubjectType('customer', CustomerSubjectSchema)
export const ProductSubject  = defineSubjectType('product',  ProductSubjectSchema)

type ProductData = {
  productId:      string
  sku:            string
  name:           string
  unitPriceCents: number
}

function makeUuid(p: Prng): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = p.int(0, 15)
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function createInvoicingWorld(seed = 42) {
  const lineTotals = new Map<string, number>()

  return createWorld({ seed })
    .withSubject(CustomerSubject)
    .withSubject(ProductSubject)

    // Invoice: one per customer subject
    .withSchema(InvoiceSchema, CustomerSubject, {
      id: (_, ctx) => makeUuid(ctx.prng.fork('invoice-id')),
      customerId: (s) => s.customerId,
      lines: (s, ctx) => {
        const count = ctx.prng.int(1, 4)
        let total = 0
        const lines = Array.from({ length: count }, () => {
          const product = ctx.registry.pick<ProductData>('product')
          const quantity       = ctx.prng.int(1, 10)
          const unitPriceCents = product.unitPriceCents
          const lineTotalCents = quantity * unitPriceCents
          total += lineTotalCents
          return {
            productId:      product.productId,
            sku:            product.sku,
            description:    product.name,
            quantity,
            unitPriceCents,
            totalCents:     lineTotalCents,
          }
        })
        lineTotals.set(s._id, total)
        return lines
      },
      totalCents: (s) => lineTotals.get(s._id) ?? 1,
    })

    // Customer summary: aggregates across customers in the registry
    .withSchema(CustomerSummarySchema, CustomerSubject, {
      customerId: (s) => s.customerId,
      name:       (s) => s.name,
      email:      (s) => s.email,
      invoiceCount: (s, ctx) =>
        ctx.registry.filter<{ customerId: string }>(
          'customer',
          (inv) => inv.customerId === s.customerId,
        ).length,
      totalOwedCents: () => 0,
    })
}
