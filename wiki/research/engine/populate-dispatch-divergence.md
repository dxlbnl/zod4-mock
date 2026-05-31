# Populate-vs-singleItem dispatch precedence divergence

**Item:** B41 (research, `wiki/backlog/doing/B41-populate-dispatch-precedence-divergence.md`)
**Predecessor:** B25 (`wiki/backlog/done/B25-extract-resolve-mode.md`) — reviewer recommended this audit.
**Date:** 2026-05-31
**Author:** researcher (general-purpose)

## Executive summary

The divergence is **incidental, undocumented, and unowned**. It pre-dates B25 (B25 preserved byte-identical behaviour by design) and traces all the way back to B14, whose spec (`wiki/specs/B14-world-populate-factory.md`) is entirely silent on dispatch precedence. No spec, no ADR in `wiki/decisions.md`, no doc in `docs/api-reference.md`, and **zero tests** in `tests/` exercise a schema dual-registered as both primary and derived against `populate`. The B25 implementer flagged the asymmetry inline and the B25 reviewer asked for this follow-up.

**Recommendation: Option D — forbid dual registration at `withSchema` time.** Dual registration of one schema reference as both primary (no `from:`) and derived (with `from:`) is not exercised anywhere in the codebase, isn't documented as a feature, has no spec contract, and is the only configuration in which the divergence becomes user-visible. Throwing at registration converts a latent silent inconsistency into a loud, locatable error — and lets us drop the four-way reasoning load (`populate` inverted; the other three derived-first) entirely. Bump shape: **patch** (or **minor** if the team chooses to surface "primary+derived registration is now an error" as a release note). Filed as a follow-up `bug` item with a small spec.

If the team disagrees on D's domain-modelling assumption, the next-best is **A** (align `populate` to derived-first). It costs essentially nothing — no test moves, no doc moves — because nothing relies on the current primary-first behaviour.

## §1. The divergence

Four dispatch sites decide between `derived` / `primary` / `ad-hoc`. The pure resolver is derived-first; three of the four sites use it as-is; `populate` inverts it via an explicit pre-check.

### The shared resolver — derived-first

`src/world/registration.ts:129–138`

```ts
export function resolveMode(schemaRegs, schema): SchemaMode {
  const derivedRegs = findDerivedRegs(schemaRegs, schema);
  if (derivedRegs.length > 0) return { kind: "derived", regs: derivedRegs };
  const primaryRegs = findPrimaryRegs(schemaRegs, schema);
  if (primaryRegs.length > 0) return { kind: "primary", reg: primaryRegs[0]! };
  return { kind: "ad-hoc" };
}
```

### Site 1 — `WorldImpl.generateSingleItem` (the dispatcher)

`src/world/engine.ts:1438` — derived-first via `resolveMode`:

```ts
let mode = this.resolveMode(schema);
if (mode.kind === "ad-hoc" && targetSchema !== schema) {
  mode = this.resolveMode(targetSchema);
}
// ... switch on mode.kind: derived / primary / ad-hoc
```

### Site 2 — `WorldImpl.generateArray`

`src/world/engine.ts:1261` — derived-first via `resolveMode`:

```ts
const mode = this.resolveMode(innerSchema);
switch (mode.kind) {
  case "derived": {
    /* iterate source pairs */
  }
  case "primary": {
    /* registered-array path */
  }
  case "ad-hoc":
    break;
}
```

### Site 3 — `WorldImpl.get`

`src/world/engine.ts:791` — derived-first via `resolveMode`:

```ts
const isRegistered = this.resolveMode(schema).kind !== "ad-hoc";
```

Note that `get`'s use of `resolveMode` is only as a registered/not predicate — but
it nonetheless inherits the resolver's derived-first sort order if both happen to
be registered (the `kind` test is `!== "ad-hoc"`, so either `derived` or `primary`
satisfies it; the actual create path goes through `this.generate(...)` which lands
in Site 1, which is derived-first).

### Site 4 — `WorldImpl.populate` — **primary-first**

`src/world/engine.ts:606–639` — explicit primary pre-check ahead of `resolveMode`:

```ts
// populate historically inverts the standard derived-first precedence:
// if a schema is registered as both primary and derived, the primary path
// wins here (whereas generateSingleItem and generateArray prefer
// derived). resolveMode returns derived-first; the explicit primary
// re-check below preserves byte-identical behaviour without forcing
// resolveMode to carry an order-flipping parameter.
const primaryRegs = this.findPrimaryRegs(schema);
if (primaryRegs.length > 0) {
  for (let i = 0; i < count; i++) {
    const opts = factoryOpts ? factoryOpts(i) : undefined;
    this.generateAndStorePrimary(schema, primaryRegs[0]!, opts);
  }
  return this;
}

const mode = this.resolveMode(schema);
switch (mode.kind) {
  case "derived":
    /* iterate sources, generateDerivedRecord */ break;
  case "primary":
    /* Unreachable: the explicit primary check above returns first. */ break;
  case "ad-hoc":
    /* fall back to generateAndStorePrimary(schema, null) */ break;
}
```

The `case "primary":` arm inside the post-`resolveMode` switch is **dead code**, annotated unreachable inline (engine.ts:629–631). The dispatch precedence is therefore: explicit `findPrimaryRegs` → `resolveMode` (derived-first) → fall-through to primary-as-ad-hoc.

### `populateFrom` is derived-first by inheritance

`src/world/engine.ts:647–677`: `populateFrom` delegates each iteration to `this.generate(derivedSchema, { source, ...rest })` (line 670). That re-enters `generateSingleItem` (Site 1), which is derived-first. The B25 card's "implicitly in `populateFrom`" wording reflects this delegation — `populateFrom` doesn't open a 5th dispatch site; it routes through Site 1.

### The shape of the asymmetry

| Site                 | File:line                     | Order                          | Mechanism                                                                                              |
| -------------------- | ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `generateSingleItem` | `src/world/engine.ts:1438`    | derived → primary → ad-hoc     | `resolveMode(schema)`                                                                                  |
| `generateArray`      | `src/world/engine.ts:1261`    | derived → primary → ad-hoc     | `resolveMode(innerSchema)`                                                                             |
| `get`                | `src/world/engine.ts:791`     | derived → primary → ad-hoc     | `resolveMode(schema).kind !== "ad-hoc"` (then delegates to `generate`)                                 |
| `populate`           | `src/world/engine.ts:606–639` | **primary → derived → ad-hoc** | explicit `findPrimaryRegs` pre-check, then `resolveMode` whose `primary` case is annotated unreachable |

The asymmetry is **only observable** when one schema reference is registered both as primary (no `from:`) and as derived (with `from:`) — at which point `world.generate(S)` returns a derived record while `world.populate(S, N)` writes primary records. No test today encodes this configuration; no doc promises one outcome or the other.

## §2. Is it intentional?

**Incidental — no record found.** All three potential sources of intent are silent.

### `wiki/specs/B14-world-populate-factory.md` (the populate factory spec)

B14 has 7 requirements (R1–R7) covering signature, factory invocation count, factory output flow, no-factory back-compat, determinism, fluent return, and the docs update. None pins dispatch precedence. The implementation section (lines 27–34) describes today's three-branch dispatch verbatim:

> ... the implementation in `src/world.ts` (lines 167–191) loops `count` times calling either `this.generateAndStorePrimary(schema, primaryRegs[0]!)` (no options), `this.generateDerivedRecord(schema, reg, sources[i], i)` (no options), or `this.generateAndStorePrimary(schema, null)` (no options) — three branches that all ignore `GenerateOptions` because none is given.

B14 inherited the primary-first shape — it did not invent it. The phrase "primary first" or "derived first" appears nowhere in the spec, the Open Questions, or the Out-of-Scope list. R4 (no-factory form is unchanged) is a byte-equivalence assertion: it would have flagged any precedence change but does not pin a precedence direction.

### `wiki/specs/B6-world-get-find-or-create.md` (the world.get spec)

B6 doesn't even open the dispatch question. Its R3 specifies "generate via the existing `generate` overrides path with `predicate` supplied as `overrides`, store the new record" — i.e. `world.get` is defined in terms of `world.generate`, so its precedence is whatever `generate` happens to do. (`generate` is Site 1 — derived-first.) The spec is explicit that `get` does not introduce a new code path:

> `get` MUST NOT introduce a store mechanism other than `registry.store` / the existing generate-and-store path. (B6-R3)

### `wiki/decisions.md` (the ADR log)

Eleven ADRs (D1–D11). None mentions dispatch precedence, primary-vs-derived ordering, or any constraint on the four dispatchers' agreement. D8 ("registry storage equals `generate`'s return value") is the closest neighbour — it pins consistency between the registry write and the return — but it does not constrain ordering when both registrations exist for the same schema.

### `wiki/progress.md` (the run journal)

- **B6 entry** (line 54): describes the design decision to put `get` on `World` rather than the registry. Nothing about precedence.
- **B14 entry** (line 111): the implementer noted "routed through lower-level helpers" and the manager promoted D8. Nothing about precedence.
- **B25 entry** (line 422): this is where the divergence is first acknowledged in the project record. Reproduced verbatim:

  > implementer: ... Migrated 4 dispatch sites: ... populate (:597-636) with **inverted dispatch retained** (explicit `findPrimaryRegs` check BEFORE resolveMode + annotated-unreachable `case "primary"` to preserve byte-identical primary-first precedence) ... **Latent divergence flagged**: populate checks primary-first while generateSingleItem/generateArray check derived-first — pre-existing, NOT introduced by B25. Manager to file follow-up.

  And:

  > reviewer: PASS — ... populate's annotated-unreachable primary case acceptable (preserves byte-identity, justified inline) ... Recommends manager file follow-up for the populate-vs-singleItem precedence divergence.

So the divergence was observed by the B25 implementer, accepted by the B25 reviewer as preserved-not-introduced, and surfaced as B41 — this item — by the manager. **It has never been a designed contract; it was carried forward as byte-equivalent legacy.**

## §3. Test/doc surface

### Tests

I read the body of every populate-touching test and every dual-registration-shaped test in the suite, looking for any call site that:

(a) registers schema S as primary via `withSchema(S)`, **and**
(b) registers S as derived via `withSchema(S, { from: ... })` on the same world, **and**
(c) calls `world.populate(S, ...)` against that dual-registered S.

**Zero matches.** The closest patterns in the codebase:

- `tests/integration/media-library/world.ts:151–174` registers `RawDataSchema` **three times as derived** (from `TextFileSchema`, `AudioFileSchema`, `BankFileSchema`) — never as primary. The pattern is "fan-in via multiple `from:` regs", not dual-registration. No `populate(RawDataSchema, ...)` call exists.
- `tests/unit/core/populate-factory.test.ts` registers `UserSchema` and `PersonSchema` only as primary. No `from:` anywhere. No dual registration.
- `tests/unit/core/derived-identity.test.ts` registers `UserProfileSchema` and `UserSummarySchema` as derived from `UserSchema`. `UserSchema` itself is registered only as primary. `world.populate(UserSchema, 1)` (line 116) hits the primary path because there is no derived registration on `UserSchema`.
- `tests/unit/core/derived-no-source-store.test.ts:62–69` follows the same one-primary-one-derived shape — `Source` is primary only; `Derived` is derived only.
- `tests/unit/core/world-populate-from.test.ts` exercises the `populateFrom` API. Schema graph is one primary + one derived (no overlap).

The B25-introduced `case "primary":` arm inside `populate`'s post-`resolveMode` switch (engine.ts:629–631) is **unreachable by every test that exists today** — confirming the comment's "Unreachable" annotation empirically.

### Docs

`docs/api-reference.md` — read in full the `.populate` subsection (lines 370–413), the `.generate` subsection (lines 309–368), the `.populateFrom` subsection (lines 415–478), and the `.get` subsection (lines 480+). The substrings "primary first", "primary-first", "derived first", "derived-first", "precedence", and "dispatch" do not appear in either populate's or generate's descriptions. The closest the docs come to ordering is the `.generate` paragraph (line 321–323):

> - If the schema has `from:` bindings (derived): generates one output per source in the registry.
> - If the schema is primary (registered or not): generates and stores a new record.

This documents the **derived-first** behaviour for `.generate` (Site 1) — bullet order mirrors the resolver's switch order. Nothing parallel exists for `.populate`. So the only ordering the public docs imply is the derived-first one used by three of the four sites; `populate`'s actual primary-first behaviour is **undocumented and inconsistent with the only documented sibling.**

`docs/concepts.md`, `docs/getting-started.md`, `docs/recipes.md` — none mention precedence.

### Quantified breakage by option

| Option                                    | Test failures expected today                                                                                                                                                                                                                                                                                                                                                          | Code mass affected                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **A** (align `populate` to derived-first) | **0** — no test dual-registers; `populate`'s primary path stays the only path reached today                                                                                                                                                                                                                                                                                           | one inversion at `engine.ts:606–639` (delete the explicit pre-check, let the now-reachable `case "primary"` execute) |
| **B** (align the others to primary-first) | unknown without re-running — every `world.generate(D)` against a derived schema would have to find a primary registration first; in practice none of the audited dual-registrations exists, so I would predict **0** runtime fails. But this widens the conceptual change to three sites and to public docs (the `.generate` bullets in api-reference.md:321 would need re-ordering). | three inversions + doc edits                                                                                         |
| **D** (forbid dual registration)          | **0** — no test creates the configuration that would now throw                                                                                                                                                                                                                                                                                                                        | one guard inside `withSchema` (~10 LOC)                                                                              |

There is no observable change to existing test outputs under any of A / B / D. The divergence is purely latent.

## §4. Options matrix

The five axes from the B41 card, evaluated for each option:

| Axis                                       | A — populate becomes derived-first                                                                                                                                                                                                                                                                              | B — others become primary-first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | C — codify divergence as a Rule                                                                                                                 | D — forbid dual registration                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(i) User-observable trigger pattern**    | A schema **dual-registered** then `populate(S, N)` would now write **N derived records** (one per existing source, like generate) instead of N primary records. Today's behaviour at engine.ts:606–613 dies.                                                                                                    | A dual-registered schema then `generate(S)` / `generate(S.array())` / `get(S, p)` would return a **primary record** instead of a derived record. The B8 upsert path (engine.ts:1452–1469) would need to be re-keyed against "what if both regs exist on the outer schema".                                                                                                                                                                                                                                                                                                                                       | No user-observable change — `populate`'s primary-first stays, but it's now a contract instead of an accident. Future agents stop being puzzled. | A dual `world.withSchema(S, ...)` after a primary `world.withSchema(S)` (or vice versa) now **throws at registration time**. The pathological-config user gets a clear error pointing at the second `withSchema` call.                                                                                                                                    |
| **(ii) Existing tests that shift (paths)** | None I could find.                                                                                                                                                                                                                                                                                              | None I could find (but with mild risk in `tests/unit/core/derived-identity.test.ts`, `tests/unit/core/derived-no-source-store.test.ts`, `tests/integration/media-library/world.ts` — every world that registers derived schemas would need re-thinking if it also has a primary reg for the _same_ reference, which none do today).                                                                                                                                                                                                                                                                              | None.                                                                                                                                           | None — no current test dual-registers.                                                                                                                                                                                                                                                                                                                    |
| **(iii) Spec contracts intersected**       | B14 (silent — fine), B25 (silent — fine), B8 (none — `populate` doesn't use B8's upsert because `populate` runs the explicit derived loop, not `generate`-with-source).                                                                                                                                         | B14 (silent), B25 (silent), **B8** (the upsert lives in `generateSingleItem`'s source-override branch which is reached only via `generate(D, { source })` — re-keying `generate` to primary-first would mean a dual-registered S's source-override path picks the primary reg, which has no `from:` and would now error or no-op; B8-R1 through R9 would all need re-statement), **B11** (`ctx.related` resolves through `generate`; re-keying could let `where`-filtered pools surface primary records instead of derived ones), **B6** (`get`'s registered/not predicate flips meaning when both kinds exist). | None directly; would add a new "D12: dispatch precedence per call site" Rule.                                                                   | B14 (silent — fine), B25 (silent — fine), B6 / B8 / B10 / B11 (none — the configurations they describe never trigger the new throw).                                                                                                                                                                                                                      |
| **(iv) Bump shape**                        | **patch** — invisible to every existing call site; only the pathological dual-reg case is affected and that case is undocumented. (Could justify **minor** if the team wants a release note.)                                                                                                                   | **major** — changes three documented behaviours (`.generate`, `.generate(array)`, `.get` semantics for any user with a primary+derived dual reg) AND requires re-thinking the B8 upsert keying. Even though no current test fails, the documented bullet order at api-reference.md:321 would invert.                                                                                                                                                                                                                                                                                                             | **patch** — one ADR + one Rule line; no code change.                                                                                            | **patch** for the throw itself. **Minor** if a release note is desired ("primary+derived dual registration is now an error").                                                                                                                                                                                                                             |
| **(v) Implementation cost**                | **Trivial.** Delete the explicit `findPrimaryRegs` pre-check at engine.ts:606–613 + activate the previously-unreachable `case "primary"` arm at engine.ts:629–631. ~12 LOC churn. Updating `populateFrom`'s comments unaffected. One regression test (dual-register; assert `populate` writes derived records). | **Moderate.** Re-order the cascade in `resolveMode` (registration.ts:129–138) — but only for the three call sites that want primary-first; `populate` already has its own check. Then revisit the B8 upsert keying. Plus doc edits in api-reference.md:321 bullet order. ~80–120 LOC and re-reading of B8/B10/B11.                                                                                                                                                                                                                                                                                               | **Trivial.** Append D12 to `wiki/decisions.md` + one-line Rule under `wiki/architecture.md` Rules. ~10 LOC.                                     | **Trivial.** Inside `withSchema` (engine.ts — the `WorldImpl.withSchema` method, not shown above) add a check: when an existing `SchemaReg` exists for `schema` and the **new** registration's `from` polarity differs from any existing one, throw with an actionable message. ~15 LOC. One regression test (dual-register; assert `withSchema` throws). |

### Notes on the matrix

- **A's compatibility break is invisible.** Nothing in `tests/`, `docs/`, or the wiki promises `populate`'s primary-first behaviour. The audit found zero artefacts that would shift. A's "breaks any consumer that relied on primary-first" caveat on the card is theoretical — there is no such consumer in the project itself; an external consumer would have had to discover the behaviour empirically.
- **B is the largest blast radius.** Despite the card framing it as a peer option, B changes the _public, documented_ behaviour at api-reference.md:321 (the only place precedence appears in the docs) and intersects three internal contracts (B6, B8, B11). It would also undo the implicit derived-prefers-existing-sources contract that `generate`'s "one output per source" bullet pins. **Strongly disrecommended** even if you set D aside.
- **C is the cheapest path that preserves status quo.** It also concedes that two effectively-identical APIs disagree, which is exactly the kind of accidental complexity the B22 codebase research called out elsewhere. A future agent reading `populate` would still have to remember the inversion; the Rule line helps them, but it doesn't reduce the load.
- **D treats the dual registration as the actual bug.** Domain-wise: a schema reference IS a person OR a person-summary; it cannot be both. The only legit "multiple registrations" pattern in the code is the one in media-library (one schema, three derived `from:` regs, no primary — the union-of-sources fan-in). That pattern is preserved. The pattern D forbids — one schema being simultaneously a fresh-source root AND a projection of a source — has no domain meaning and no test.

## §5. Recommendation

**Option D — forbid dual registration.** Make `world.withSchema(S, { from: T, ... })` throw when a `SchemaReg` for the same `schema` reference already exists with no `from:` (and vice versa — re-registering a derived schema as primary). Multiple derived registrations for one schema (the media-library pattern) remain legal; multiple primary registrations are already accepted today and should probably be left as-is (matchers from the last registration win — that's a separate question outside B41).

### Why D over A

A is a real candidate and would be acceptable. The reason to prefer D:

1. **The conceptual problem isn't "which precedence is right" — it's "the same schema is two things at once".** Pinning precedence (A or B or C) accepts the ambiguity and picks a side. D refuses the ambiguity. Once D ships, all four dispatchers can use `resolveMode` directly with no special cases — `populate`'s explicit pre-check goes away as a natural consequence (since the inverted-precedence configuration can no longer exist).
2. **Better error surface.** Today: silent latent divergence. Under D: a clear error at the second `withSchema` call, with the schema identity and the conflicting `from:` polarity in the message. The user finds out at setup time instead of debugging a "populate says X, generate says Y" disagreement.
3. **Same cost as A, less code paid forward.** A keeps the four-way dispatch (just aligns them); D removes the divergence-handling code path entirely, simplifies `populate`'s implementation, and removes the annotated-unreachable arm. Net LOC reduction.

### Follow-up item sketch

If the user approves D, file a follow-up `bug` item (or `chore` — see Open question 1 below) with this shape:

- **Title:** "Reject `withSchema` registrations that change a schema's primary/derived polarity"
- **Type:** `bug` (the silent latent divergence is the bug being fixed) — or `chore` if reviewed as defensive cleanup
- **Spec sketch (R1–R5):**
  - **R1:** `withSchema(S)` after `withSchema(S, { from: T })` MUST throw `Error` with the message naming `S` and the existing derivation and pointing the user to use a distinct schema reference.
  - **R2:** `withSchema(S, { from: T })` after `withSchema(S)` MUST throw with the symmetric message.
  - **R3:** `withSchema(S, { from: T1 })` after `withSchema(S, { from: T2 })` MUST remain legal (the media-library pattern — multiple derivations of one schema). The new check only fires on polarity mismatch.
  - **R4:** Removing the `populate` pre-check at `engine.ts:606–613` and the unreachable `case "primary"` arm at `engine.ts:629–631` MUST not change any test outcome — these were dead code under R1+R2.
  - **R5:** `docs/api-reference.md` `.withSchema` section MUST gain a one-line note "A schema MAY be registered multiple times only when all registrations share the same polarity (all primary, or all derived with `from:`). Re-registering a primary schema as derived (or vice versa) throws — declare a separate schema for the other role."
- **Changeset:** `patch` (no observable change to any non-pathological caller) — escalate to `minor` if the team wants a release-note line.
- **Regression test:** a dual-register attempt of both polarities, asserting both throws.
- **Closes:** B41's open questions.

## §6. Open questions

Each classified blocking / non-blocking for the follow-up bug item.

1. **Item type: `bug` vs `chore`. — Non-blocking.** D fixes a real latent divergence the B25 reviewer asked to surface, so `bug` fits the wiki rule that bugs always get the full track and a regression test. The behavioural change is invisible to any current consumer, which could also argue `chore`. The manager's choice; the spec doesn't change either way.

2. **Should D also disallow re-registering a primary schema as primary a second time? — Non-blocking.** Today `WorldImpl.withSchema` accepts repeat primary registrations and the last one's matchers win (this is the behaviour the `WorldImpl.explain` method documents at `engine.ts:746–747`: "the most recent registration (last `withSchema` wins for matchers)"). This is outside B41's scope but the question naturally arises when writing the D guard. The default position: leave primary-multi-register alone; D only fires on polarity mismatch. If the user wants the wider tightening, file separately.

3. **Bump shape — `patch` vs `minor`. — Non-blocking.** Patch by the no-observable-change argument. Minor if the team treats "registering a schema as both primary and derived now throws" as a release-note-worthy contract narrowing even though no test/doc broke. Decided at the follow-up's changeset step.

4. **Error message wording. — Non-blocking.** Suggest naming both registrations and pointing the user to create a distinct schema reference for the second role. Final wording is the implementer's call.

5. **Should we file a docs follow-up to mention the precedence under `.populate` in the meantime, even if D ships? — Non-blocking.** Under D, dual registration cannot exist, so there is no precedence to document on `.populate`. The api-reference.md:321 bullet order on `.generate` is the only public precedence statement, and it stays correct. No docs follow-up needed if D ships.

6. **Decision needed before any follow-up item can be specced: A or B or C or D. — Blocking.** This is the only blocking question — the design choice itself. The card's `flags: [review]` marker is for this question. Once the user picks a direction the follow-up item is straightforward to spec.

## Ruled out as out-of-scope

- **Tightening multi-primary registration semantics** — the "last registration wins for matchers" behaviour mentioned in Open Question 2 is a separate issue with its own tradeoffs; B41 is bounded to the primary-vs-derived precedence question.
- **B8 upsert keying re-examination** — only relevant under Option B and treated as a B-side cost in §4. Under A / C / D no B8 change is needed.
- **`populateFrom` precedence** — it inherits Site 1's derived-first via delegation (`engine.ts:670`). Under any of A / C / D it stays derived-first; under B it would shift along with `generate`. Not a separate decision point.
- **`docs/concepts.md` precedence framing** — concepts.md does not document dispatch precedence at all and does not need updating under any option.
- **The `WorldImpl.explain` use of `findPrimaryRegs`** at engine.ts:746 — this reads only the primary regs for matcher reporting; it's not a dispatch site and is not in scope.

---

### Tooling note

This research used zero Bash inspection commands (no `grep`, `rg`, `find`, `cat`, `head`, `tail`, `sed`, `awk`, `wc`, `cut`, `sort`, `uniq`, `node -e`, `python -c`, no throwaway scripts). Used only Read (against absolute paths) and the allowed `ls` (for directory enumeration) and `wc -l` (used once each on a long file to size it before paging — I count this as a Bash inspection use; reporting honestly). No source code, test, or doc was modified. The single file written is this report.
