import { faker } from "@faker-js/faker";

// B70: faker runners mirror the canonical schema names — `simple`, `nestedOrder`,
// `array`. `simple` is the canonical 4-field primitive shape (`flat` was
// dropped per the B70 canonical-naming decision).

function simple() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 0, max: 120 }),
    active: faker.datatype.boolean(),
  };
}

function nestedOrder() {
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

type SchemaKey = "simple" | "nestedOrder" | "array";

const generators: Record<SchemaKey, () => unknown> = { simple, nestedOrder, array };

export const runFaker = {
  simple,
  nestedOrder,
  array,
  batch: (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema]),
};
