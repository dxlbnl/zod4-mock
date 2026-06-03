---
id: B76
title: Light-theme visual QA across site routes
type: chore
priority: low
created: 2026-06-03
provenance: gen-bench X2
---

## Description

`site/src/lib/styles/tokens.css` defines a `html.light` token set, but no visual
QA has been done across all routes. Walk every route in light mode, capture
screenshots, fix contrast / spacing issues, document any tokens that need light
overrides.

Acceptance: every route (`/`, `/bench`, `/showcase`, `/table`, `/docs/*`) is
visually correct in light mode with the same information density as dark mode.
