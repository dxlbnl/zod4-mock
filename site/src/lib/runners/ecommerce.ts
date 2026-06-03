import { createWorld } from "zod4-mock";
import {
  userSchema,
  categorySchema,
  productSchema,
  variantSchema,
  reviewSchema,
  orderSchema,
  type EcommerceWorld,
  type Product,
  type Variant,
} from "../schemas/ecommerce";

export function generateWorld(seed?: number): EcommerceWorld {
  const world = createWorld({ seed })
    .withSchema(userSchema)
    .withSchema(categorySchema, {
      relations: { parent: categorySchema },
      matchers: {
        parentId: (ctx) => {
          const existing = ctx.registry.all(categorySchema);
          return existing.length > 0 ? ctx.related("parent").id : null;
        },
      },
    })
    .withSchema(productSchema, {
      relations: { category: categorySchema },
      matchers: {
        categoryId: (ctx) => ctx.related("category").id,
      },
    })
    .withSchema(variantSchema, {
      relations: { product: productSchema },
      matchers: {
        productId: (ctx) => ctx.related("product").id,
      },
    })
    .withSchema(reviewSchema, {
      relations: { product: productSchema, user: userSchema },
      matchers: {
        productId: (ctx) => ctx.related("product").id,
        userId: (ctx) => ctx.related("user").id,
      },
    })
    .withSchema(orderSchema, {
      relations: {
        user: userSchema,
        product: productSchema,
        variant: variantSchema,
      },
      matchers: {
        userId: (ctx) => ctx.related("user").id,
        items: (ctx) => {
          const count = ctx.prng.int(1, 5);
          return Array.from({ length: count }, () => {
            const product = ctx.related("product") as Product;
            const productVariants = ctx.registry.filter(
              variantSchema,
              (v: Variant) => v.productId === product.id,
            ) as Variant[];
            const variant =
              productVariants.length > 0
                ? ctx.prng.pick(productVariants as [Variant, ...Variant[]])
                : (ctx.related("variant") as Variant);
            return {
              productId: product.id,
              variantId: variant.id,
              qty: ctx.prng.int(1, 10),
              unitPrice: product.price,
            };
          });
        },
        total: (ctx) => {
          const items = (
            ctx.current as { items?: { qty: number; unitPrice: number }[] }
          ).items;
          return (
            items?.reduce((sum, item) => sum + item.qty * item.unitPrice, 0) ??
            0
          );
        },
      },
    });

  world
    .populate(userSchema, 10)
    .populate(categorySchema, 5)
    .populate(productSchema, 20)
    .populate(variantSchema, 60)
    .populate(reviewSchema, 30)
    .populate(orderSchema, 5);

  return {
    users: world.registry.all(userSchema),
    categories: world.registry.all(categorySchema),
    products: world.registry.all(productSchema),
    variants: world.registry.all(variantSchema),
    reviews: world.registry.all(reviewSchema),
    orders: world.registry.all(orderSchema),
  };
}
