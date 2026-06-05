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

### Repo-side prep (2026-06-05 — manager)

Vercel deploys for a subdirectory of a pnpm workspace need the install
command to run from the **workspace root**, not from `site/`. The card's
step 3 ("Set Install command to `pnpm install --frozen-lockfile`") would
fail as written because pnpm at `site/` doesn't see the workspace.

To make the deploy work the moment the maintainer points Vercel at the
repo, the manager landed `site/vercel.json` with the correct config:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "cd .. && pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "framework": "sveltekit"
}
```

This lets the maintainer:

1. Create the Vercel project against the `dxlbnl/zod4-mock` GitHub repo.
2. Set **Root Directory** to `site`.
3. Leave **Install Command** / **Build Command** unset in the dashboard
   — `vercel.json` overrides.
4. Trigger preview deploy; verify routes (see card body); promote.
5. Map DNS to `zod4-mock.vercel.app`.

Repo-side preflight verified:

- `pnpm build` (in `site/`) succeeds; SvelteKit adapter-vercel emits to
  `.vercel/output` (Vercel handshake; no `outputDirectory` override
  needed).
- `@sveltejs/adapter-vercel` configured at `site/svelte.config.js` with
  runtime `nodejs22.x`.
- All site routes (`/`, `/bench`, `/showcase`, `/docs/*`, `/explorer`)
  prerender / SSR cleanly per `pnpm site:build`.
- Card body's six-step checklist updated to reflect `vercel.json` taking
  over install/build (steps 3-4 obsoleted by the file).

Remaining maintainer actions are dashboard + DNS only — none can be
performed by the manager pipeline.
