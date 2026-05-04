/**
 * @module registry
 * In-memory store for every value generated within a world.
 *
 * The registry is the bridge between independently generated datasets.
 * For example, an `AnnotationSchema` matcher can call
 * `ctx.registry.pick('sentence')` to reference a sentence that was generated
 * earlier, ensuring referential integrity across different schemas.
 *
 * Items are stored under a string type name that mirrors the subject-type name
 * (e.g. `'person'`, `'text-file'`) or an arbitrary label for corpus data.
 */

import type { Registry, Prng } from './types.js'

export class SubjectRegistry implements Registry {
  private readonly store_: Map<string, unknown[]> = new Map()

  /**
   * @param prng - A PRNG used to pick random items.  Should be a fork of the
   *               world's master PRNG so registry picks are deterministic.
   */
  constructor(private readonly prng: Prng) {}

  store(type: string, item: unknown): void {
    throw new Error('not implemented')
  }

  all(type: string): unknown[] {
    throw new Error('not implemented')
  }

  pick(type: string): unknown {
    throw new Error('not implemented')
  }

  pickBy(type: string, predicate: (item: unknown) => boolean): unknown {
    throw new Error('not implemented')
  }

  filter(type: string | string[], predicate: (item: unknown) => boolean): unknown[] {
    throw new Error('not implemented')
  }

  count(type: string): number {
    throw new Error('not implemented')
  }
}
