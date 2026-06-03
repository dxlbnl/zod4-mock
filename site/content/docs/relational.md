---
title: Relational Guide
slug: relational
---

# Relational Guide

When you generate an `Order`, it needs a `userId` that references a real `User`. When you
generate a `Review`, both `userId` and `productId` must point to entities that actually exist.
`zod4-mock` makes this straightforward.

## The problem with faker

With faker you generate each entity independently, then manually wire foreign keys:

```typescript
const users = Array.from({ length: 10 }, () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName()
}));

const orders = Array.from({ length: 20 }, () => ({
  id: faker.string.uuid(),
  // Manual pick — easy to forget, easy to drift
  userId: users[Math.floor(Math.random() * users.length)].id
}));
```

## The zod4-mock approach

Generate each entity array from its schema, then assign foreign keys in a second pass.
Every ID is a real UUID that actually exists in the dataset.

```typescript
import { generate } from 'zod4-mock';
import { userSchema, productSchema, reviewSchema } from './schemas/ecommerce';

const users = Array.from({ length: 10 }, () => generate(userSchema));
const products = Array.from({ length: 20 }, () => generate(productSchema));

// Wire cross-entity IDs in one focused pass
const reviews = Array.from({ length: 30 }, () => ({
  ...generate(reviewSchema),
  userId: users[Math.floor(Math.random() * users.length)].id,
  productId: products[Math.floor(Math.random() * products.length)].id
}));
```

## The e-commerce entity graph

The gen-bench showcase uses a 7-entity relational world:

```typescript
// User
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(60),
  email: z.string().email(),
  address: z.object({ street: z.string(), city: z.string(), country: z.string() }),
  createdAt: z.date()
});

// Product (references Category)
const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  categoryId: z.string().uuid(), // → Category.id
  price: z.number().min(0.01).max(9999.99),
  rating: z.number().min(1).max(5)
});

// Review (references both User and Product)
const reviewSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(), // → Product.id
  userId: z.string().uuid(),    // → User.id
  rating: z.number().min(1).max(5),
  body: z.string(),
  createdAt: z.date()
});
```

## Try a relational schema

```typescript playground
z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email()
  }),
  order: z.object({
    id: z.string().uuid(),
    status: z.enum(['pending', 'shipped', 'delivered']),
    total: z.number().min(0)
  })
})
```
