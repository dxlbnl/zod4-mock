/**
 * World setup for the invoicing integration test.
 *
 * Demonstrates:
 * - Multiple subject types in a single world (customers + products)
 * - Computed fields (totalCents derived from line items)
 * - Cross-referencing stored subjects from registry within matchers
 */

import { createWorld, defineSubjectType } from '../../../src/index.js'
import {
  CustomerSubjectSchema,
  ProductSubjectSchema,
  InvoiceSchema,
  CustomerSummarySchema,
} from './schemas.js'

export const CustomerSubject = defineSubjectType('customer', CustomerSubjectSchema)
export const ProductSubject  = defineSubjectType('product',  ProductSubjectSchema)

export function createInvoicingWorld(seed = 42) {
  return createWorld({ seed })
    .withSubject(CustomerSubject)
    .withSubject(ProductSubject)

    // Invoice: one per customer subject
    .withSchema(InvoiceSchema, CustomerSubject, {
      id:         (_, ctx) => ctx.prng.fork('invoice-id').random().toString(36).slice(2),
      customerId: (s) => s.customerId,
      lines: (_, ctx) => {
        // Each line references a random product from the registry
        const count = ctx.prng.int(1, 4)
        return Array.from({ length: count }, () => {
          const product = ctx.registry.pick('product') as {
            productId: string
            sku: string
            name: string
            unitPriceCents: number
          }
          const quantity = ctx.prng.int(1, 10)
          const unitPriceCents = product.unitPriceCents
          return {
            productId:      product.productId,
            sku:            product.sku,
            description:    product.name,
            quantity,
            unitPriceCents,
            totalCents:     quantity * unitPriceCents,
          }
        })
      },
      totalCents: () => 0, // recomputed by transform if needed
    })

    // Customer summary: aggregates across invoices in the registry
    .withSchema(CustomerSummarySchema, CustomerSubject, {
      customerId: (s) => s.customerId,
      name:       (s) => s.name,
      email:      (s) => s.email,
      invoiceCount: (s, ctx) =>
        ctx.registry.filter(
          'customer',
          (inv: unknown) =>
            (inv as { customerId: string }).customerId === s.customerId,
        ).length,
      totalOwedCents: () => 0,
    })
}
