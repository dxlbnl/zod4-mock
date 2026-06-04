/**
 * B70 — canonical site schema set. Single entry point for both the CLI bench
 * (`site/bench/*`) and the browser bench (`site/src/lib/runners/*`).
 *
 * Removing a schema file in this directory removes it from both harnesses —
 * R1's structural acceptance criterion.
 */

export { simple, simple3, type SimpleRecord } from "./simple.js";
export { user, user3, type UserRecord } from "./user.js";
export { address, address3, nested, nested3, type NestedRecord } from "./nested.js";
export { nestedOrder, nestedOrder3, type NestedOrderRecord } from "./nestedOrder.js";
export { array, array3, type ArrayRecord } from "./array.js";
export { CompanySchema, AddressSchema, UserSchema } from "./matcher.js";
export {
  userSchema,
  categorySchema,
  productSchema,
  variantSchema,
  reviewSchema,
  orderSchema,
  type User,
  type Category,
  type Product,
  type Variant,
  type Review,
  type Order,
  type EcommerceWorld,
} from "./ecommerce.js";
