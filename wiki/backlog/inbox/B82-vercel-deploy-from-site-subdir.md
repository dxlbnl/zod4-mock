---
id: B82
title: Vercel deploy from site/ subdir
type: chore
priority: high
flags: [review]
created: 2026-06-03
---

## Description

Set up a Vercel project against the zod4-mock repo that deploys from
`site/`, reachable at **`zod4-mock.vercel.app`** (rebrand from the
`gen-bench.vercel.app` URL the imported project used). Steps:

1. Create a new Vercel project against the zod4-mock GitHub repo (or
   migrate the existing gen-bench Vercel project's source — either way the
   target name is `zod4-mock`).
2. Set **Root directory** to `site`.
3. Set **Install command** to `pnpm install --frozen-lockfile`
   (workspace-aware).
4. Set **Build command** to `pnpm build`.
5. Trigger a preview deploy. Verify `/`, `/bench`, `/showcase`,
   `/docs/getting-started` render with no console errors.
6. Promote to production / map DNS to `zod4-mock.vercel.app` only after
   step 5 passes.

Phasing per [B84](B84-site-architecture-rebuild.md) §10 Q7 answer
(2026-06-03): land **after** Phase 1 ships, so the rebranded URL points at
a working Phase 1 build from day one. Until then, keep the existing
gen-bench Vercel project deploying from the archived gen-bench repo.

Acceptance: `zod4-mock.vercel.app` serves from `zod4-mock@HEAD/site` with
no functional regression. (`gen-bench.vercel.app` may stay live as a
redirect or be retired; maintainer's call.)

## Notes

- Out-of-tree maintainer task — cannot be executed by the manager pipeline.
  Captured as a card so it tracks against the merge release.
- Review-flagged: maintainer takes the actions.
