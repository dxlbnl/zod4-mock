---
id: B35
title: Refactor — build `key-map.ts` text aliases programmatically
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

`src/generators/data/key-map.ts` ([352 LOC](../../src/generators/data/key-map.ts))
has 10 identical length-aware text closures spread across `text`,
`description`, `note`, `summary`, `comment`, `body`, `content`, `message`,
`omschrijving`, `bericht` — same closure copied per key.

Replace with a programmatic build:

```ts
const TEXT_ALIASES = [
  "text", "description", "note", "summary", "comment",
  "body", "content", "message",
  "omschrijving", "bericht",  // nl
] as const;

for (const k of TEXT_ALIASES) DEFAULT_KEY_MAP[k] = textWithLength;
```

Same pattern likely applies to other key clusters (name-like, id-like).
Cuts ~80 LOC. Move the constant into a small `key-aliases.ts` data file so the
table reads as data, not literal.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#13**.
- Dimension: 2 #3.
- Size: **XS**.
- B16 already exposes the key map via `world.explain(schema)` and `docs/key-heuristics.md` — the regen path stays compatible since the resulting `DEFAULT_KEY_MAP` is byte-identical.
