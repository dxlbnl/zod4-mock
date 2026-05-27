# Practice: performance

Load for items with hot paths, large data volumes, or an explicit latency/throughput budget.

## Knowledge

- **Measure before optimizing.** Profile to find the real cost; never optimize on a hunch.
- **Know the budget.** Optimize against a concrete target from the spec (e.g. "< 200ms p95"),
  not a vague "make it fast".
- **Fix the dominant cost first.** Algorithmic/complexity and I/O (N+1 queries, repeated work)
  usually dwarf micro-optimizations.
- **Cache deliberately** — with a clear invalidation story. A stale cache is a correctness bug.
- **Don't trade correctness or readability for unmeasured speed.** Premature optimization is a
  cost, not a win.

## Rationalizations → rebuttals

| Excuse | Reality |
|---|---|
| "This feels slow." | Feelings aren't data — measure before and after. |
| "Micro-optimize everywhere to be safe." | Find the hotspot; most code isn't on the hot path. |
| "Add a cache, it'll be faster." | Only with a measured need and an invalidation plan — else it's a bug source. |

## Red flags

- An optimization with no before/after measurement.
- A bottleneck asserted but never profiled.
- N+1 queries or repeated work inside a loop.
- Caching with no invalidation story.
- Clarity sacrificed for an unproven gain.

## Verification (evidence the practice was applied)

- A before/after measurement backs the change.
- The relevant performance budget from the spec is met.
- Correctness tests are still green — speed did not break behaviour.
