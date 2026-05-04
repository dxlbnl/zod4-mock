/**
 * @module registry
 * In-memory store for all data generated within a world.
 */

import type { Registry, Prng } from './types.js'

export class SubjectRegistry implements Registry {
  private readonly buckets: Map<string, unknown[]> = new Map()

  constructor(private readonly prng: Prng) {}

  store(type: string, item: unknown): void {
    let bucket = this.buckets.get(type)
    if (!bucket) {
      bucket = []
      this.buckets.set(type, bucket)
    }
    bucket.push(item)
  }

  all<T = unknown>(type: string): T[] {
    return (this.buckets.get(type) ?? []) as T[]
  }

  pick<T = unknown>(type: string): T {
    const items = this.all<T>(type)
    if (items.length === 0) throw new Error(`registry: no items of type '${type}'`)
    return items[this.prng.int(0, items.length - 1)]!
  }

  pickBy<T = unknown>(type: string, predicate: (item: T) => boolean): T {
    const matches = this.all<T>(type).filter(predicate)
    if (matches.length === 0) throw new Error(`registry: no matching items of type '${type}'`)
    return matches[this.prng.int(0, matches.length - 1)]!
  }

  filter<T = unknown>(type: string | string[], predicate: (item: T) => boolean): T[] {
    const types = Array.isArray(type) ? type : [type]
    return types.flatMap((t) => this.all<T>(t)).filter(predicate)
  }

  count(type: string): number {
    return this.all(type).length
  }
}
