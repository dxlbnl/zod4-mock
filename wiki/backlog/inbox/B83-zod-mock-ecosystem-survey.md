---
id: B83
title: Survey Zod fixture/mock libraries; expand /bench coverage
type: research
priority: high
flags: [review]
created: 2026-06-03
---

## Description

Current `/bench` compares zod4-mock vs `@anatine/zod-mock` vs `@faker-js/faker`.
The Zod fixture/mock ecosystem is wider — `zod-fixture`, `zod-mock`,
`@praha/zod-mock`, `zod-factory`, etc. (full inventory TBD). Producing only
the 3-way comparison undersells zod4-mock's positioning relative to the wider
field, and the @anatine/zod-mock comparison is starting to feel like a
straw-man (Zod-v3-only, unmaintained).

Outputs:

1. `wiki/research/reports/zod-mock-ecosystem-survey.md` listing every Zod
   fixture/mock library on npm with > N downloads/week or last-publish within
   12 months.
2. Per-library criteria for inclusion in `/bench`: active maintenance,
   Zod-v4 support, deterministic mode, schema-driven (or hand-coded with
   schema-conformance verification).
3. Recommendation for which to add (with bench runner stubs sized as
   follow-up cards if scope is large).

Acceptance: report committed; review-flagged so the maintainer picks the
final inclusion list before B69/B70 implementation locks the runner shape.

## Notes

- Gates B69 (web worker) and B70 (unify CLI+browser schemas) — once the
  runner list is fixed, the worker and schema-set design can finalize.
- D17 (CLI bench is citable) implies new runners ship to CLI first; the
  browser tier follows.
