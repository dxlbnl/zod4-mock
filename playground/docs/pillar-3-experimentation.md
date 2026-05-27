# Pillar 3: Execution & Experimentation (UX Deep Dive)

This pillar provides transparency and "what-if" tools. The UX focuses on proving the library's stability guarantees and allowing safe experimentation with overrides.

---

## 1. The Generation Sandbox: The "Experiment" Mode

The goal is to test edge cases (e.g., _"What if this field is null?"_) without polluting the primary schema or world setup.

### 🔘 The Interaction Flow

1.  **Trigger**: User toggles **"Experiment Mode"** in the Output Pane.
2.  **Split Interface**:
    - **Top/Left**: A JSON editor for `overrides` (e.g., `{"status": "failed"}`).
    - **Bottom/Right**: A **Live Diff** view of the resulting data.
3.  **Real-time Diffing**: Unchanged data is dimmed; modified values are highlighted in Amber.
4.  **Promote Action**: A "Promote to Schema" button allows the user to turn a successful override into a permanent `.default()` or `.catch()` modifier on the schema.

### 🎨 Visual Language

- **The "Sandbox" Watermark**: A subtle diagonal watermark in the background of the preview reminds the user they are in a temporary sandbox.
- **Modified Badges**: In the diff view, a small `[OVERRIDE]` badge appears next to pinned values.

---

## 2. PRNG Trace: Proving Determinism

The UX answers the most common question: _"Why is this value specifically 'John'?"_

### 🔘 The Interaction Flow

- **The "Trace" Click**: User clicks a "Math" icon next to any generated value in the Data View.
- **Seed Lineage Popover**: A clean, technical popover appears showing the derivation:
  - `World Seed: 42`
  - `Subject ID: user#1`
  - `Field Path: profile.email`
  - `Final Hash: 0x8a2f...`
- **Re-Roll Simulation**: A button to "Test different seed" for _just this field_ to see what other values the PRNG would produce from the current schema.

### 🎨 Visual Language

- **Derivation Path**: A breadcrumb-style formula: `42` → `user#1` → `email` = `Result`.
- **Entropy Sparkline**: A tiny, animated sparkline showing the PRNG's state "noise" for that field.

---

## 3. Heuristics Explorer: The "Magic" Revealed

The UX makes the library's "smart defaults" feel predictable rather than mysterious.

### 🔘 The Interaction Flow

- **Search Lab**: A "Try a key name" input.
- **Live Matching**: As you type `postal`, the UI highlights the `zipcode` heuristic and shows a sample result.
- **Source Link**: For every match, a link takes the user to the [Key Heuristics docs](../../docs/key-heuristics.md) to see the full implementation logic.

### 🎨 Visual Language

- **Match Highlights**: Matching characters are bolded in the list.
- **Built-in vs. Custom**: A clear visual distinction (icons) between library-provided and user-defined heuristics.

---

## 🏗️ UX Summary Table

| Interaction          | Action            | UX "Winning" Moment                                               |
| :------------------- | :---------------- | :---------------------------------------------------------------- |
| **Sandbox Diffing**  | JSON Override     | _"I tested the 'error' state without breaking my clean schema."_  |
| **PRNG Tracing**     | Click "Math" icon | _"Now I understand why this value is stable and how seeds work."_ |
| **Heuristic Search** | Type field name   | _"I see why 'email' is auto-generated—there's a rule for it."_    |
