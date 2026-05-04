/**
 * Integration tests — invoicing domain.
 *
 * Verifies end-to-end referential integrity and business invariants across
 * the Customer → Product → Invoice → LineItem hierarchy.
 *
 * All tests will fail with "not implemented" until fase 3.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { InvoiceSchema, CustomerSummarySchema, LineItemSchema } from './schemas.js'
import { createInvoicingWorld } from './world.js'

describe('invoicing integration', () => {
  // ---------------------------------------------------------------------------
  // Schema validation
  // ---------------------------------------------------------------------------

  it('generates invoices that validate against InvoiceSchema', () => {
    const world    = createInvoicingWorld()
    const invoices = world.generate(z.array(InvoiceSchema).min(3).max(8))
    for (const inv of invoices) {
      expect(InvoiceSchema.safeParse(inv).success).toBe(true)
    }
  })

  it('every invoice has at least one line item', () => {
    const world    = createInvoicingWorld()
    const invoices = world.generate(z.array(InvoiceSchema).min(5))
    for (const inv of invoices) {
      expect(inv.lines.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('line items validate against LineItemSchema', () => {
    const world    = createInvoicingWorld()
    const invoices = world.generate(z.array(InvoiceSchema).min(3))
    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(LineItemSchema.safeParse(line).success).toBe(true)
      }
    }
  })

  // ---------------------------------------------------------------------------
  // Referential integrity
  // ---------------------------------------------------------------------------

  it('every invoice.customerId refers to an existing customer', () => {
    const world      = createInvoicingWorld()
    const invoices   = world.generate(z.array(InvoiceSchema).min(5))
    const customerIds = new Set(
      world.registry.all('customer').map((c) => (c as { customerId: string }).customerId),
    )
    for (const inv of invoices) {
      expect(customerIds.has(inv.customerId)).toBe(true)
    }
  })

  it('every line.productId refers to an existing product', () => {
    const world      = createInvoicingWorld()
    const invoices   = world.generate(z.array(InvoiceSchema).min(3))
    const productIds = new Set(
      world.registry.all('product').map((p) => (p as { productId: string }).productId),
    )
    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(productIds.has(line.productId)).toBe(true)
      }
    }
  })

  // ---------------------------------------------------------------------------
  // Business invariants
  // ---------------------------------------------------------------------------

  it('line.totalCents === line.quantity * line.unitPriceCents', () => {
    const world    = createInvoicingWorld()
    const invoices = world.generate(z.array(InvoiceSchema).min(3))
    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(line.totalCents).toBe(line.quantity * line.unitPriceCents)
      }
    }
  })

  it('generates customer summaries that validate', () => {
    const world     = createInvoicingWorld()
    world.generate(z.array(InvoiceSchema).min(5))
    const summaries = world.generate(z.array(CustomerSummarySchema))
    for (const s of summaries) {
      expect(CustomerSummarySchema.safeParse(s).success).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  it('same seed → identical invoices', () => {
    const build = (seed: number) =>
      createInvoicingWorld(seed).generate(z.array(InvoiceSchema).length(3))

    expect(build(1)).toEqual(build(1))
  })

  it('different seeds → different invoices', () => {
    const build = (seed: number) =>
      createInvoicingWorld(seed).generate(z.array(InvoiceSchema).length(3))

    expect(build(1)).not.toEqual(build(2))
  })
})
