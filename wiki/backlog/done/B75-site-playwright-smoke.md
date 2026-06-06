---
id: B75
title: Playwright smoke tests for site routes
type: feature
priority: medium
created: 2026-06-03
provenance: gen-bench X1
spec: wiki/specs/B75-site-playwright-smoke.md
---

## Description

Add a Playwright smoke suite that visits `/`, `/bench`, `/showcase`, `/table`,
`/docs/getting-started` and asserts no console errors or unhandled rejections.
Wire into `pnpm site:test:component` (existing Playwright runner under
`site/vite.config.ts`).

Acceptance: a CI-runnable Playwright test that fails when any of those routes
throws a runtime error.
