# Benchmark Results (CLI harness, latest)

> Source: gen-bench/bench/results/latest.json (in-repo)
> Collected: 2026-05-13
> Published: 2026-05-13

Captured snapshot of the CLI benchmark output. These are the numbers cited throughout the wiki. Re-running `pnpm bench` overwrites `latest.json` and appends to `history.json`.

```
Timestamp:  2026-05-13T19:12:24.411Z
Node:       v24.14.1
Versions:   faker 9.9.0, @anatine/zod-mock 3.14.0, zod4-mock 0.2.3
            (zod3 3.25.76, zod4 4.4.3)
Config:     warmup=1000  runs=5000
```

## Simple schema

| Library | avg (ms) | min (ms) | ops/sec | cold start (ms) |
|---|---|---|---|---|
| faker        | 0.0081 | 0.0036 | 123 230 | 0.64 |
| zod3-mock    | 0.0314 | 0.0248 |  31 877 | 1.16 |
| **zod4-mock** | **0.0060** | **0.0035** | **166 136** | 1.05 |

`zod4-mock` is the fastest on the simple tier — ~5.2× zod3-mock and ~1.35× faker.

## User schema (realistic fields: uuid, email, enum, optional)

| Library | avg (ms) | min (ms) | ops/sec | cold start (ms) |
|---|---|---|---|---|
| **faker**       | **0.0071** | **0.0042** | **140 406** | 0.47 |
| zod3-mock    | 0.0501 | 0.0366 |  19 945 | 0.65 |
| zod4-mock    | 0.0100 | 0.0057 |  99 516 | 0.39 |

`zod4-mock` is ~5.0× zod3-mock but ~0.71× of faker. Faker is faster per call.

## Nested schema (uuid + email + nested object + optional + array + record)

| Library | avg (ms) | min (ms) | ops/sec | cold start (ms) |
|---|---|---|---|---|
| **faker**       | **0.0176** | **0.0113** | **56 871** | 0.49 |
| zod3-mock    | 0.0967 | 0.0671 |  10 339 | 0.57 |
| zod4-mock    | 0.0353 | 0.0169 | ~28 333 | (truncated) |

`zod4-mock` is ~2.7× zod3-mock but ~0.50× of faker.

## Headline reading

- vs `@anatine/zod-mock`: zod4-mock wins every tier by 2.7×–5.2×.
- vs hand-coded `faker`: zod4-mock wins on simple, loses on user (~30% slower) and nested (~2× slower).
- The "fast" claim is safe against schema-driven competitors; framing zod4-mock as "fastest" overall is not supported by the data.
