# Practice: browser-testing

Load for items with **UI scenarios** (`Scenario (UI):`) in a browser-enabled project. UI
verification is opt-in (frontend projects, enabled at `/bootstrap`); a non-UI project prunes
this practice.

## Knowledge

- **Verify in a real browser, not just a unit test.** "The component test passed" does not
  prove the rendered page works. Exercise the **golden path + key states** the spec's UI
  scenarios name.
- **Assert by role / text, not pixels.** Target the accessible name, role, or visible text
  (reuse the `accessibility` practice). Pixel/coordinate assertions are brittle and meaningless.
- **Watch the signals the browser gives you** — **console errors**, **failed network
  requests**, and obvious **accessibility-tree** problems are failures even if the happy path
  "looks" right.
- **Two complementary mechanisms:** committed **Playwright** tests for durable, CI re-runnable
  regression (written by the `test-writer` for UI scenarios); the **Chrome DevTools MCP** for
  the reviewer to *drive and inspect the live app* (navigate/click/type, DOM + a11y tree,
  console + network, perf traces) and **capture a screenshot** as evidence.
- **Never** drive the browser with ad-hoc `node`/`python` scripts — use Playwright or the MCP.

## Rationalizations → rebuttals

| Excuse | Reality |
|---|---|
| "The unit test passed, so the UI works." | Render it and exercise it — wiring, layout, and runtime errors only show in a browser. |
| "A screenshot proves it." | A screenshot is evidence, not verification — *drive* the golden path and assert the outcome. |
| "The console errors are unrelated." | A console error or failed request on the path is a finding; investigate, don't wave it through. |
| "I'll assert the element is at x=240." | Assert by role/text; coordinates break on every layout tweak. |

## Red flags

- Asserting on pixels/coordinates or screenshot diffs instead of role/text.
- Ignoring console errors or failed network requests during the run.
- Claiming a UI scenario verified with no browser run and no screenshot.
- A UI scenario with a non-observable `THEN` ("looks good") — push it back to the spec.

## Verification (evidence the practice was applied)

- Each UI scenario's golden path was **walked** in a real browser (Playwright test and/or MCP
  drive), asserting the observable `THEN` by role/text.
- Console + network were clean during the run (or failures are reported as findings).
- A **screenshot** of each verified state is attached and cited.
