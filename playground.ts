// playground.ts — edit freely, run with: pnpm play  (watch: pnpm play:watch)
import { describe, it } from "vitest";
import { z } from "zod";
import { generate, createWorld } from "./src/index.js";

const print = (label: string, data: unknown) => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
};

// ---------------------------------------------------------
// 1. Zero-Config & Advanced Types
// ---------------------------------------------------------

const UserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string().min(20),
  email: z.string().email().toUpperCase(),
  age: z.number().min(80).max(1200).multipleOf(2),
});

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("login"), timestamp: z.date(), ip: z.string() }),
  z.object({ type: z.literal("signup"), userId: z.string().uuid() }),
]);

describe.only("Zero-Config & Advanced Types", () => {
  it("Generates realistic data and complex unions without any configuration", () => {
    print("Zero-Config User", generate(UserSchema));
    print("Zero-Config Action", generate(ActionSchema));
  });
});

// ---------------------------------------------------------
// 2. Determinism & Field Stability
// ---------------------------------------------------------

// We expand the UserSchema from Act 1 to show field stability.
const ExtendedUserSchema = UserSchema.extend({
  email: z.string().email(),
  bio: z.string(),
  avatarUrl: z.string().url(),
});

describe("Determinism & Field Stability", () => {
  it("Guarantees identical values for existing fields when new ones are added", () => {
    const seed = 123;
    const v1 = createWorld({ seed }).generate(UserSchema);
    const v2 = createWorld({ seed }).generate(ExtendedUserSchema);

    print("User V1 (Basic)", v1);
    print("User V2 (Extended)", v2);

    // Note: v2.firstName === v1.firstName despite new fields
  });
});

// ---------------------------------------------------------
// 3. Composition & Nested Matchers
// ---------------------------------------------------------

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

const UserWithAddressSchema = ExtendedUserSchema.extend({
  address: AddressSchema,
});

describe("Composition & Nested Matchers", () => {
  it("Automatically applies sub-schema matchers to nested fields", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(AddressSchema, {
        matchers: {
          street: (ctx) => ctx.gen.location.street(),
          city: (ctx) => ctx.gen.location.city(),
        },
      })
      .withSchema(UserWithAddressSchema);

    const result = world.generate(UserWithAddressSchema);
    print("User with Nested Matchers", result);
  });
});

// ---------------------------------------------------------
// 4. Business Logic & Registry Lookups
// ---------------------------------------------------------

const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  priceCents: z.number().int().min(100),
});

const OrderSchema = z.object({
  orderId: z.string().cuid2(),
  customerId: z.string().uuid(),
  quantity: z.number().int().min(1).max(5),
  unitPriceCents: z.number().int(),
  totalCents: z.number().int(),
});

describe("Business Logic & Registry Lookups", () => {
  it("Calculates totals and picks random customers from the registry", () => {
    const world = createWorld({ seed: 99 });

    // We reuse UserSchema from Act 1
    world.populate(UserSchema, 1);

    world.withSchema(OrderSchema, {
      matchers: {
        customerId: (ctx) => ctx.registry.pick(UserSchema).id,
        totalCents: (ctx) => {
          return (ctx.current.quantity ?? 1) * (ctx.current.unitPriceCents ?? 1);
        },
      },
    });

    const product = generate(ProductSchema);
    const order = world.generate(OrderSchema, {
      overrides: { unitPriceCents: product.priceCents },
    });

    print("User", world.registry.all(UserSchema));
    print("Order with calculated total", order);
  });
});

// ---------------------------------------------------------
// 5. Relational Graphs & Derived Schemas
// ---------------------------------------------------------

const PostSchema = z.object({
  id: z.string().cuid2(),
  authorId: z.string().uuid(),
  title: z.string(),
});

const PublicProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
});

describe("Relational Graphs & Derived Schemas", () => {
  it("Syncs IDs across relations and projects users into public profiles", () => {
    // We reuse UserSchema as our "Author" anchor
    const world = createWorld({ seed: 777 })
      .withSchema(UserSchema)
      .withSchema(PostSchema, {
        relations: { author: UserSchema },
        matchers: {
          authorId: (ctx) => ctx.related("author").id,
        },
      })
      .withSchema(PublicProfileSchema, {
        from: UserSchema,
        matchers: {
          id: (ctx) => ctx.source.id,
          displayName: (ctx) => `${ctx.source.firstName} ${ctx.source.lastName[0]}.`,
        },
      });

    world.populate(UserSchema, 2);

    print("User", world.generate(UserSchema.array()));
    print("Related Posts", world.generate(z.array(PostSchema).length(3)));
    print("Derived Profile", world.generate(PublicProfileSchema));
  });
});

// ---------------------------------------------------------
// 6. Recursion
// ---------------------------------------------------------

interface Category {
  id: string;
  name: string;
  children: Category[];
}

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    id: z.string().cuid2(),
    name: z.string(),
    children: z.array(CategorySchema).max(2),
  }),
);

describe("Recursion", () => {
  it("Generates deterministic tree structures", () => {
    const world = createWorld({ seed: 123 }).withSchema(CategorySchema, {
      matchers: {
        name: (ctx) => ctx.gen.company.name(),
      },
    });
    print("Recursive Tree", world.generate(CategorySchema));
  });
});

// ---------------------------------------------------------
// 7. The "Tweak" Kit
// ---------------------------------------------------------

const TaskSchema = z.object({
  title: z.string(),
  desc: z.string().optional(),
  done: z.boolean().nullable(),
});

describe("The 'Tweak' Kit", () => {
  it("Allows pinning specific values and controlling optionality", () => {
    const world = createWorld({ seed: 42, optionalProbability: 1 });

    print("Sparse Task", world.generate(TaskSchema));
    print("Overridden Task", world.generate(TaskSchema, { overrides: { title: "FIXED" } }));
  });
});

// ---------------------------------------------------------
// 8. Simple Benchmark
// ---------------------------------------------------------

const SimpleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

describe("Simple Benchmark", () => {
  it("Measures raw 'generate()' performance for a standard schema", () => {
    const iterations = 10000;
    const seed = 123;

    console.log(`\n=== Simple Benchmark: ${iterations} iterations ===`);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      generate(SimpleSchema, { seed });
    }
    const end = performance.now();

    const duration = end - start;
    console.log(`Total Time: ${duration.toFixed(2)}ms`);
    console.log(`Avg Latency: ${(duration / iterations).toFixed(4)}ms/op`);
    console.log(`Throughput: ${(1000 / (duration / iterations)).toFixed(0)} ops/sec`);
  });
});

// ---------------------------------------------------------
// 9. Speed Test (Benchmark)
// ---------------------------------------------------------

const BigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  age: z.number().int().min(0).max(120),
  email: z.string().email(),
  tags: z.array(z.string()).max(10),
  nested: z.object({
    a: z.number(),
    b: z.string(),
    c: z.array(z.number()),
  }),
});

describe("Speed Test", () => {
  it("Compares current performance with a high-volume load", () => {
    const iterations = 10000;
    const world = createWorld({ seed: 42 }).withSchema(BigSchema);

    console.log(`\n=== Speed Test: ${iterations} iterations ===`);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      world.generate(BigSchema);
    }
    const end = performance.now();

    const totalMs = end - start;
    const perOp = totalMs / iterations;

    console.log(`[Reused World]`);
    console.log(`Total: ${totalMs.toFixed(2)}ms`);
    console.log(`Avg:   ${perOp.toFixed(4)}ms/op`);
    console.log(`Throughput: ${(1000 / perOp).toFixed(0)} ops/sec`);

    // Comparison: Zero-Config (re-creating world every time)
    const startZero = performance.now();
    for (let i = 0; i < iterations; i++) {
      generate(BigSchema, { seed: 42 });
    }
    const endZero = performance.now();
    const totalZero = endZero - startZero;
    const perOpZero = totalZero / iterations;

    console.log(`\n[Zero-Config (Fresh World per call)]`);
    console.log(`Total: ${totalZero.toFixed(2)}ms`);
    console.log(`Avg:   ${perOpZero.toFixed(4)}ms/op`);
    console.log(`Penalty: ${((perOpZero / perOp - 1) * 100).toFixed(1)}% slower than reused world`);
  });
});
