# Getting Started (Onboarding)

> Source: gen-bench/content/docs/getting-started.md (in-repo, mdsvex)
> Collected: 2026-05-13
> Published: 2026-05-13

# Getting Started

`zod4-mock` generates realistic mock data directly from your Zod v4 schemas — no
separate factory functions, no manual field mapping.

## Installation

```bash
pnpm add zod4-mock zod
```

## Quick start

Edit the code below — the last variable is live-generated as you type.

```typescript playground
import { generate } from "zod4-mock";
import { z } from "zod";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(60),
  email: z.string().email(),
  age: z.number().int().min(18).max(99),
  role: z.enum(["admin", "user", "guest"]),
});

const user = generate(userSchema);
```

## Why zod4-mock?

| Feature                | zod4-mock | faker | zod-mock |
| ---------------------- | --------- | ----- | -------- |
| Zod v4 schemas         | ✓         | —     | ✗        |
| Schema-driven output   | ✓         | ✗     | ✓        |
| Relational IDs         | ✓         | ✗     | ✗        |
| Seeded / deterministic | ✓         | ✓     | ✗        |
| Type-safe output       | ✓         | ✗     | ✓        |

- **[API Reference →](/docs/api)** — every supported Zod type and option
- **[Relational Guide →](/docs/relational)** — build a consistent multi-entity world
- **[Library Comparison →](/docs/comparison)** — side-by-side with faker and zod-mock
