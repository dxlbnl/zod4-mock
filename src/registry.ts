/**
 * @module registry
 * In-memory store for all data generated within a world.
 * Keys are Zod schema object references (not strings).
 */

import type { ZodTypeAny } from "zod";
import type { Registry, Prng } from "./types.js";

export class SchemaRegistry implements Registry {
  private readonly buckets: Map<ZodTypeAny, unknown[]> = new Map();

  constructor(private readonly prng: Prng) {}

  store(schema: ZodTypeAny, item: unknown): void {
    let bucket = this.buckets.get(schema);
    if (!bucket) {
      bucket = [];
      this.buckets.set(schema, bucket);
    }
    bucket.push(item);
  }

  all<T = unknown>(schema: ZodTypeAny): T[] {
    return (this.buckets.get(schema) ?? []) as T[];
  }

  pick<T = unknown>(schema: ZodTypeAny): T {
    const items = this.all<T>(schema);
    if (items.length === 0) throw new Error(`registry: no items stored for this schema`);
    return items[this.prng.int(0, items.length - 1)]!;
  }

  filter<T = unknown>(schema: ZodTypeAny, predicate: (item: T) => boolean): T[] {
    return this.all<T>(schema).filter(predicate);
  }

  count(schema: ZodTypeAny): number {
    return (this.buckets.get(schema) ?? []).length;
  }
}

/** @deprecated Use SchemaRegistry. Kept for backward compatibility with test fixtures. */
export const SubjectRegistry = SchemaRegistry;
