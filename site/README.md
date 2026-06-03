# `@zod4-mock/site` — zod4-mock showcase & benchmark

Homepage + benchmark + showcase site for [zod4-mock](https://github.com/dxlbnl/zod4-mock): schema-driven mock data generation for Zod v4 with relational consistency across entities. Lives as the `site/` workspace member; deploys to `gen-bench.vercel.app`.

```sh
npm install zod4-mock
```

**[Live site →](https://gen-bench.vercel.app)** · [npm](https://npmjs.com/package/zod4-mock) · [Docs](/docs/getting-started)

## What's here

- `/` — Project landing page with feature matrix and relational demo preview
- `/bench` — Live browser benchmark: zod4-mock vs @anatine/zod-mock vs faker
- `/showcase` — Relational e-commerce world: 7 entity types with consistent cross-entity IDs
- `/table` — DOM stress test (100 – 5k rows)
- `/docs/getting-started` — Interactive documentation with live schema playground

## Development

```sh
pnpm install
pnpm dev        # start dev server at http://localhost:5173
pnpm check      # svelte-check type checking
pnpm test:unit  # unit tests (vitest)
pnpm lint       # oxlint
pnpm bench      # CLI performance benchmark → bench/results/latest.json
```

## Contributing

For library bugs or feature requests, open an issue on the [zod4-mock](https://github.com/dxlbnl/zod4-mock) repo. Site work is tracked in `wiki/backlog/inbox/B69-B83` and design notes live in `wiki/site/`.
