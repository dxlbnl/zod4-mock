/**
 * World setup for the invoicing integration test.
 *
 * Demonstrates:
 * - Multiple subject types in a single world (customers + products)
 * - Computed fields (totalCents derived from line items)
 * - Cross-referencing stored subjects from registry within matchers
 */

import { createWorld, defineSubjectType, generators } from "../../../src/index.js";
import {
  CustomerSubjectSchema,
  ProductSubjectSchema,
  InvoiceSchema,
  CustomerSummarySchema,
} from "./schemas.js";

export const CustomerSubject = defineSubjectType("customer", CustomerSubjectSchema, {
  relations: { purchasedProducts: { type: "product", cardinality: "1..n" } },
  derive: {
    email: ({ name }, ctx) => {
      const [firstName, lastName] = name!.split(" ");
      return `${firstName![0]}${ctx.prng.pick([
        ".",
        "_",
        "",
      ])}${lastName}${ctx.prng.int(10, 99)}@${generators.internet.domain(ctx.prng)}`.toLowerCase();
    },
  },
});
export const ProductSubject = defineSubjectType("product", ProductSubjectSchema, {
  keyMap: {
    name: (prng) => generators.lorem.words(prng, 3),
  },
});

type ProductData = {
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
};

export function createInvoicingWorld(seed = 42) {
  const lineTotals = new Map<string, number>();

  return (
    createWorld({
      seed,
      generators: {
        // B2B prices in €1 increments, €1–€500 — tighter range than the schema allows
        unitPriceCents: (_schema, ctx) => ctx.prng.int(1, 500) * 100,
      },
    })
      .withSubject(CustomerSubject)
      .withSubject(ProductSubject)

      // Invoice: one per customer subject
      .withSchema(InvoiceSchema, CustomerSubject, {
        id: (_, ctx) => generators.string.uuid(ctx.prng.fork("invoice-id")),
        customerId: (s) => s.customerId,
        lines: (s, ctx) => {
          let total = 0;
          const products = ctx.related<ProductData[]>("purchasedProducts");
          const lines = products.map((product) => {
            const quantity = ctx.prng.int(1, 10);
            const unitPriceCents = product.unitPriceCents;
            const lineTotalCents = quantity * unitPriceCents;
            total += lineTotalCents;
            return {
              productId: product.productId,
              sku: product.sku,
              description: product.name,
              quantity,
              unitPriceCents,
              totalCents: lineTotalCents,
            };
          });
          lineTotals.set(s._id, total);
          return lines;
        },
        totalCents: (s) => lineTotals.get(s._id) ?? 1,
      })

      // Customer summary: aggregates across customers in the registry
      .withSchema(CustomerSummarySchema, CustomerSubject, {
        customerId: (s) => s.customerId,
        name: (s) => s.name,
        email: (s) => s.email,
        invoiceCount: (s, ctx) =>
          ctx.registry.filter<{ customerId: string }>(
            "customer",
            (inv) => inv.customerId === s.customerId,
          ).length,
        totalOwedCents: () => 0,
      })
  );
}
