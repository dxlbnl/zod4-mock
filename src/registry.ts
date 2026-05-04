import type { Registry, Prng } from './types.js'

export class SubjectRegistry implements Registry {
  private readonly store_: Map<string, unknown[]> = new Map()

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
