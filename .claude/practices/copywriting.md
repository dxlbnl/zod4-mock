# Practice: copywriting

Load for items that produce user-facing text — UI labels, button text, empty states, error and
success messages, onboarding copy. (Copywriting is a practice, not a specialist role: any agent
writing user-facing strings applies it.)

## Knowledge

- **Write for the user, in their words.** Plain language, no internal jargon or implementation
  terms.
- **Be concise and specific.** Say the one thing that matters; cut filler.
- **Consistent voice and terminology.** The same concept gets the same word everywhere; follow
  the project's voice in the wiki/spec.
- **Error messages: what happened + what to do next.** No blame, no bare error codes; give the
  user their next action.
- **Localizable.** Whole sentences, not concatenated fragments; no idioms that won't translate.

## Rationalizations → rebuttals

| Excuse | Reality |
|---|---|
| "Copy is cosmetic." | Copy *is* the UX for most users — it's part of the contract, not decoration. |
| "A placeholder is fine for now." | Ship real copy, or raise the wording as an **open question** — don't invent product voice silently. |
| "Developers understand the message." | Write for the end user, not the author. |

## Red flags

- An error message that blames the user or shows only a code/stack.
- Different terms for the same concept across screens.
- Placeholder/lorem text or truncated strings left in the diff.
- Concatenated sentence fragments that can't be localized.

## Verification (evidence the practice was applied)

- User-facing strings match the spec's voice and terminology.
- Error messages state what happened **and** the next action.
- No placeholder/lorem copy remains in the diff.
- Any wording the spec left undefined was raised as an **open question** (per the spec's open-
  questions handling), not invented.
