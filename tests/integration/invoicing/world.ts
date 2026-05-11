/**
 * Invoicing integration — schemas and world setup.
 *
 * Domain: B2B invoicing. Customers receive invoices made up of line items
 * that reference products from a shared catalogue.
 *
 * Business invariants that must hold across the generated dataset:
 *   - line.totalCents === line.quantity * line.unitPriceCents
 *   - invoice.totalCents === sum(lines[*].totalCents)
 *   - every invoice.customerId refers to a generated customer
 *   - every line.productId refers to a generated product
 *
 * The world demonstrates three patterns:
 *
 * 1. Registry lookups — invoice lines pick random products from the registry.
 *
 * 2. Computed field dependencies — totalCents must equal the sum of all line
 *    totals. The `lines` matcher accumulates the total in a closure Map so the
 *    `totalCents` matcher can read it back on the next field.
 *
 * 3. Derived schema — CustomerSummarySchema uses `from: CustomerSchema` so
 *    each summary is driven by the same customer instance as the invoices,
 *    keeping summary.customerId === invoice.customerId.
 */

import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// A B2B customer.
export const CustomerSchema = z.object({
  customerId: z.uuid(),
  name: z.string().min(2).max(80),
  vatNumber: z.string().regex(/^NL\d{9}B\d{2}$/),
  email: z.email(),
});

// A product in the shared catalogue.
export const ProductSchema = z.object({
  productId: z.uuid(),
  sku: z.string().min(4).max(20),
  name: z.string().min(2).max(100),
  unitPriceCents: z.number().int().min(100).max(50_000),
});

// A single line on an invoice.
export const LineItemSchema = z.object({
  productId: z.uuid(), // → ProductSchema.productId
  sku: z.string(),
  description: z.string(),
  quantity: z.number().int().min(1).max(20),
  unitPriceCents: z.number().int().min(1),
  totalCents: z.number().int().min(1), // must equal quantity * unitPriceCents
});

// A full invoice sent to a customer.
export const InvoiceSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(), // → CustomerSchema.customerId
  invoiceDate: z.date(),
  dueDate: z.date(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  lines: z.array(LineItemSchema).min(1).max(10),
  totalCents: z.number().int().min(1), // must equal sum(lines[*].totalCents)
  currency: z.enum(["EUR", "USD", "GBP"]),
});

// A rolled-up view of a customer's invoicing history.
export const CustomerSummarySchema = z.object({
  customerId: z.uuid(), // → CustomerSchema.customerId
  name: z.string(),
  email: z.email(),
  invoiceCount: z.number().int().min(0),
  totalOwedCents: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export function createInvoicingWorld(seed = 42) {
  // Tracks the computed line total per invoice instance so `totalCents` can
  // read the value accumulated by the `lines` matcher.
  const lineTotals = new Map<string, number>();

  return (
    createWorld({ seed })
      // CustomerSchema — primary. Field-name heuristics cover customerId,
      // name, and email. vatNumber uses the schema-based regex generator.
      .withSchema(CustomerSchema)

      // ProductSchema — primary. SKU and name need realistic domain values.
      // unitPriceCents is constrained to €1–€500 in whole-euro steps.
      .withSchema(ProductSchema, {
        matchers: {
          sku: (ctx) => `SKU-${ctx.gen.string.alphanumeric(6).toUpperCase()}`,
          name: (ctx) => ctx.gen.commerce.productName(),
          unitPriceCents: (ctx) => ctx.prng.int(1, 500) * 100,
        },
      })

      // InvoiceSchema relates to CustomerSchema for the customerId foreign key.
      // The `lines` matcher builds each line item by picking a product from the
      // registry (products must be generated first). It accumulates the running
      // total in `lineTotals` so the `totalCents` field can read it back.
      .withSchema(InvoiceSchema, {
        relations: { customer: CustomerSchema },
        matchers: {
          customerId: (ctx) => ctx.related("customer").customerId,
          lines: (ctx) => {
            const count = ctx.prng.int(1, 5);
            let invoiceTotal = 0;

            const lines = Array.from({ length: count }, () => {
              const product = ctx.registry.pick(ProductSchema);
              const quantity = ctx.prng.int(1, 10);
              const lineCents = quantity * product.unitPriceCents;
              invoiceTotal += lineCents;

              return {
                productId: product.productId,
                sku: product.sku,
                description: product.name,
                quantity,
                unitPriceCents: product.unitPriceCents,
                totalCents: lineCents,
              };
            });

            lineTotals.set(ctx.fieldPath.replace(".lines", ""), invoiceTotal);
            return lines;
          },
          totalCents: (ctx) => lineTotals.get(ctx.fieldPath.replace(".totalCents", "")) ?? 1,
        },
      })

      // CustomerSummarySchema is a projection of CustomerSchema.
      // `from: CustomerSchema` ties each summary to a specific customer
      // instance, so summary.customerId always matches an invoice.customerId.
      .withSchema(CustomerSummarySchema, {
        from: CustomerSchema,
        matchers: {
          customerId: (ctx) => ctx.source.customerId,
          name: (ctx) => ctx.source.name,
          email: (ctx) => ctx.source.email,
        },
      })
  );
}

// Convenience builder used by most tests.
export function buildInvoicingDataset(seed = 42) {
  const world = createInvoicingWorld(seed);
  const products = world.generate(z.array(ProductSchema).min(5).max(10));
  const invoices = world.generate(z.array(InvoiceSchema).min(5).max(10));
  const summaries = world.generate(z.array(CustomerSummarySchema));
  return { world, products, invoices, summaries };
}
