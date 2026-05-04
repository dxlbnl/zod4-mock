/**
 * Domain schemas for the invoicing integration test.
 *
 * Domain: B2B invoicing — customers receive invoices with line items.
 * Products are a shared catalogue referenced by invoice lines.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Subject schemas (identity fields)
// ---------------------------------------------------------------------------

export const CustomerSubjectSchema = z.object({
  customerId: z.string().uuid(),
  name:       z.string().min(2).max(80),
  vatNumber:  z.string().regex(/^NL\d{9}B\d{2}$/),
  email:      z.string().email(),
})

export const ProductSubjectSchema = z.object({
  productId:    z.string().uuid(),
  sku:          z.string().min(4).max(20),
  name:         z.string().min(2).max(100),
  unitPriceCents: z.number().int().min(1).max(1_000_000),
})

// ---------------------------------------------------------------------------
// API / output schemas
// ---------------------------------------------------------------------------

export const LineItemSchema = z.object({
  productId:      z.string().uuid(),
  sku:            z.string(),
  description:    z.string(),
  quantity:       z.number().int().min(1).max(100),
  unitPriceCents: z.number().int().min(1),
  totalCents:     z.number().int().min(1),
})

export const InvoiceSchema = z.object({
  id:           z.string().uuid(),
  customerId:   z.string().uuid(),
  invoiceDate:  z.date(),
  dueDate:      z.date(),
  status:       z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  lines:        z.array(LineItemSchema).min(1).max(10),
  totalCents:   z.number().int().min(1),
  currency:     z.enum(['EUR', 'USD', 'GBP']),
})

export const CustomerSummarySchema = z.object({
  customerId:    z.string().uuid(),
  name:          z.string(),
  email:         z.string().email(),
  invoiceCount:  z.number().int().min(0),
  totalOwedCents: z.number().int().min(0),
})
