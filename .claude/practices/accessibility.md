# Practice: accessibility

Load for any item that ships user-facing UI.

## Knowledge

- **Semantic structure first.** Use the right element/role (`button`, `nav`, headings in
  order). A `div` with a click handler is not a button.
- **Keyboard operable.** Everything usable with a mouse must work with the keyboard; focus
  order is logical and **focus is visible**.
- **Accessible names.** Every control/image has a label or alt text a screen reader can read.
- **Don't encode meaning in color alone.** Pair color with text/icon; meet WCAG AA contrast.
- **Respect user settings** — reduced motion, text scaling, dark mode where applicable.

## Rationalizations → rebuttals

| Excuse | Reality |
|---|---|
| "Our users use a mouse." | Keyboard + screen-reader access is the contract for UI, not an extra. |
| "We'll do a11y in a later pass." | Retrofitting is far costlier; bake it into the component now. |
| "Screen readers are a niche." | Accessible names also drive tests, automation, and SEO. |

## Red flags

- A clickable `div`/`span` with no role and no `tabindex`.
- An image with no `alt`, or a form control with no associated label.
- Focus that disappears or jumps illogically when tabbing.
- State shown only by color (red/green) with no text or icon.

## Verification (evidence the practice was applied)

- The golden path is operable **keyboard-only**.
- Interactive elements expose an accessible name/role (assert that, not just pixels).
- Color contrast meets AA for text and meaningful UI.
- At least one UI scenario asserts an accessible name/role rather than only layout.
