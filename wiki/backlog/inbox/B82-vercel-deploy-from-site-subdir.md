---
id: B82
title: Vercel deploy from site/ subdir
type: chore
priority: high
flags: [review]
created: 2026-06-03
---

## Description

Reconfigure the gen-bench Vercel project (or create a new one against this
repo) to deploy from `site/` instead of `/`. Steps:

1. Add the zod4-mock GitHub repo to Vercel (or migrate the existing
   gen-bench Vercel project's source).
2. Set **Root directory** to `site`.
3. Set **Install command** to `pnpm install --frozen-lockfile`
   (workspace-aware).
4. Set **Build command** to `pnpm build`.
5. Trigger a preview deploy. Verify `/`, `/bench`, `/showcase`,
   `/docs/getting-started` render with no console errors.
6. Promote to production / move DNS only after step 5 passes.

Keep the existing gen-bench Vercel project deploying from the archived
gen-bench repo until step 5 verifies.

Acceptance: `gen-bench.vercel.app` (or successor URL) serves from
`zod4-mock@HEAD/site` with no functional regression.

## Notes

- Out-of-tree maintainer task — cannot be executed by the manager pipeline.
  Captured as a card so it tracks against the merge release.
- Review-flagged: maintainer takes the actions.
