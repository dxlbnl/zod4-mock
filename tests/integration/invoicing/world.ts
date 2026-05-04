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

type ProductData = {
  productId:      string
  sku:            string
  name:           string
  unitPriceCents: number
}

export function createInvoicingWorld(seed = 42) {
  return createWorld({ seed })
    .withSubject(CustomerSubject)
    .withSubject(ProductSubject)

    // Invoice: one per customer subject
    .withSchema(InvoiceSchema, CustomerSubject, {
      id:         (_, ctx) => ctx.prng.fork('invoice-id').random().toString(36).slice(2),
      customerId: (s) => s.customerId,
      lines: (_, ctx) => {
        const count = ctx.prng.int(1, 4)
        return Array.from({ length: count }, () => {
          const product = ctx.registry.pick<ProductData>('product')
          const quantity       = ctx.prng.int(1, 10)
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
      totalCents: () => 0,
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
