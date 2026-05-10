/**
 * Integration tests — invoicing.
 *
 * Verifies referential integrity and mathematical correctness across the
 * Customer → Product → Invoice → LineItem hierarchy.
 *
 * The most interesting invariant here is arithmetic: line.totalCents must
 * equal line.quantity * line.unitPriceCents, and invoice.totalCents must
 * equal the sum of all its lines. These cannot be verified by schema
 * validation alone — they require inspecting the generated values.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CustomerSchema,
  ProductSchema,
  InvoiceSchema,
  CustomerSummarySchema,
  LineItemSchema,
  createInvoicingWorld,
  buildInvoicingDataset,
} from "./world.js";

describe("invoicing", () => {

  // ---------------------------------------------------------------------------
  // Schema validity
  //
  // Generated data must satisfy all Zod constraints — types, number ranges,
  // regex patterns, enum membership. If the pipeline produces an out-of-range
  // value the schema parse catches it here before the business-logic tests run.
  // ---------------------------------------------------------------------------

  it("invoices pass InvoiceSchema.safeParse", () => {
    const { invoices } = buildInvoicingDataset();
    for (const inv of invoices) {
      expect(InvoiceSchema.safeParse(inv).success).toBe(true);
    }
  });

  it("every line item passes LineItemSchema.safeParse", () => {
    const { invoices } = buildInvoicingDataset();
    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(LineItemSchema.safeParse(line).success).toBe(true);
      }
    }
  });

  it("customer summaries pass CustomerSummarySchema.safeParse", () => {
    const { summaries } = buildInvoicingDataset();
    for (const s of summaries) {
      expect(CustomerSummarySchema.safeParse(s).success).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Referential integrity
  //
  // Foreign keys must point to entities that were actually generated.
  // invoice.customerId is produced by the `customer` relation, so it always
  // resolves to a real CustomerSchema instance in the registry.
  // line.productId is picked from the product registry inside the matcher.
  // ---------------------------------------------------------------------------

  it("every invoice.customerId refers to a generated customer", () => {
    const { invoices, world } = buildInvoicingDataset();
    const customerIds = new Set(world.registry.all(CustomerSchema).map((c) => c.customerId));

    for (const inv of invoices) {
      expect(customerIds.has(inv.customerId)).toBe(true);
    }
  });

  it("every line.productId refers to a generated product", () => {
    const { invoices, products } = buildInvoicingDataset();
    const productIds = new Set(products.map((p) => p.productId));

    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(productIds.has(line.productId)).toBe(true);
      }
    }
  });

  it("summary.customerId matches a customer in the registry", () => {
    const { summaries, world } = buildInvoicingDataset();
    const customerIds = new Set(world.registry.all(CustomerSchema).map((c) => c.customerId));

    for (const s of summaries) {
      expect(customerIds.has(s.customerId)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Business invariants
  //
  // These are the maths checks that go beyond what Zod can express. They
  // verify that the `lines` and `totalCents` matchers cooperate correctly
  // through the closure Map used to pass the running total between fields.
  // ---------------------------------------------------------------------------

  it("line.totalCents === line.quantity * line.unitPriceCents", () => {
    const { invoices } = buildInvoicingDataset();
    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(line.totalCents).toBe(line.quantity * line.unitPriceCents);
      }
    }
  });

  it("invoice.totalCents === sum of its line totalCents", () => {
    const { invoices } = buildInvoicingDataset();
    for (const inv of invoices) {
      const expected = inv.lines.reduce((sum, l) => sum + l.totalCents, 0);
      expect(inv.totalCents).toBe(expected);
    }
  });

  it("every invoice has at least one line", () => {
    const { invoices } = buildInvoicingDataset();
    for (const inv of invoices) {
      expect(inv.lines.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ---------------------------------------------------------------------------
  // Domain-specific values
  //
  // Unit prices are generated in €1 steps (multiples of 100 cents) in the
  // range €1–€500. These are B2B pricing conventions set in the world's
  // product matcher — not Zod constraints — so the test must verify them.
  // ---------------------------------------------------------------------------

  it("unit prices are multiples of €1 (100 cents) in the range €1–€500", () => {
    const { invoices } = buildInvoicingDataset();
    for (const inv of invoices) {
      for (const line of inv.lines) {
        expect(line.unitPriceCents % 100).toBe(0);
        expect(line.unitPriceCents).toBeGreaterThanOrEqual(100);
        expect(line.unitPriceCents).toBeLessThanOrEqual(50_000);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Derived schema — customer summary
  //
  // CustomerSummarySchema uses `from: CustomerSchema`, so each summary is
  // driven by the same underlying customer instance as the invoices.
  // Summary identity fields (customerId, name, email) must match the source.
  // ---------------------------------------------------------------------------

  it("summary.customerId and email match the source customer", () => {
    const { summaries, world } = buildInvoicingDataset();
    const customerByID = new Map(
      world.registry.all(CustomerSchema).map((c) => [c.customerId, c]),
    );

    for (const s of summaries) {
      const customer = customerByID.get(s.customerId);
      expect(customer).toBeDefined();
      expect(s.name).toBe(customer!.name);
      expect(s.email).toBe(customer!.email);
    }
  });

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  it("same seed produces identical invoices", () => {
    const a = buildInvoicingDataset(1).invoices;
    const b = buildInvoicingDataset(1).invoices;
    expect(a).toEqual(b);
  });

  it("different seeds produce different invoices", () => {
    const a = buildInvoicingDataset(1).invoices;
    const b = buildInvoicingDataset(2).invoices;
    expect(a).not.toEqual(b);
  });

  it("changing the seed does not break the arithmetic invariant", () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const world    = createInvoicingWorld(seed);
      world.generate(z.array(ProductSchema).min(5));
      const invoices = world.generate(z.array(InvoiceSchema).min(3));

      for (const inv of invoices) {
        const expected = inv.lines.reduce((sum, l) => sum + l.totalCents, 0);
        expect(inv.totalCents).toBe(expected);
      }
    }
  });

});
