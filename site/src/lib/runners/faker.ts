import { faker } from "@faker-js/faker";

function flat() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    age: faker.number.int({ min: 18, max: 99 }),
    score: faker.number.float({ min: 0, max: 1, fractionDigits: 4 }),
    active: faker.datatype.boolean(),
    createdAt: faker.date.past(),
    role: faker.helpers.arrayElement(["admin", "user", "moderator", "guest"] as const),
    bio: faker.lorem.sentence(),
    phone: faker.phone.number(),
  };
}

function nested() {
  return {
    id: faker.string.uuid(),
    total: faker.number.float({ min: 0, max: 9999, fractionDigits: 2 }),
    status: faker.helpers.arrayElement([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ] as const),
    customer: {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zip: faker.location.zipCode(),
        country: faker.location.country(),
      },
    },
  };
}

function array() {
  return Array.from({ length: 50 }, () => ({
    id: faker.string.uuid(),
    sku: faker.commerce.isbn(),
    color: faker.color.human(),
    size: faker.helpers.arrayElement(["XS", "S", "M", "L", "XL", "XXL"] as const),
    stock: faker.number.int({ min: 0, max: 999 }),
    price: faker.number.float({ min: 0.01, max: 999.99, fractionDigits: 2 }),
  }));
}

type SchemaKey = "flat" | "nested" | "array";

const generators: Record<SchemaKey, () => unknown> = { flat, nested, array };

export const runFaker = {
  flat,
  nested,
  array,
  batch: (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema]),
};
