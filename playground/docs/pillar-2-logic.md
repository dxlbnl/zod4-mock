# Pillar 2: Advanced Logic & Bindings (UX Deep Dive)

This pillar bridges the gap between a visual builder and a professional code-based generation pipeline. The UX must cater to both "Quick Mapping" (no-code) and "Advanced Scripting" (pro-code).

---

## 1. The Field Binding Popover: Smart Mapping

The UX goal is to allow users to "wire" API Schema fields to Subject data without ever opening a code editor.

### 🔘 The Interaction Flow
1.  **Trigger**: User clicks the **Link Icon** next to a field name in the Builder Pane.
2.  **Mapping Popover**: A small, focused menu appears with three modes:
    -   **Mode A: Auto (Heuristic)**: Default state. Shows which built-in heuristic is currently active (e.g., *"Matched: email"*).
    -   **Mode B: Map to Subject Field**: 
        -   Shows a searchable list of all fields in the bound subject.
        -   **Smart Suggestion**: If the API field is `userId` and the subject has `id`, the `id` field is highlighted as the "Best Match."
    -   **Mode C: Custom Logic**: A "Code" icon that, when clicked, automatically opens the **Logic Drawer** for this specific field.

### 🎨 Visual Language
-   **Status Indicators**: 
    -   🟢 **Green Badge**: "Explicitly mapped to `subject.key`."
    -   🔵 **Blue Badge**: "Custom matcher logic applied."
    -   ⚪ **Grey Badge**: "Auto-generating via heuristics."
-   **The "Unmapped" State**: Fields that cannot be mapped and have no heuristic are flagged with a subtle warning icon.

---

## 2. The Logic Drawer: The Pro-Code IDE

For complex logic (derivations, registry lookups, data transformations), the playground provides a full-height coding environment.

### 🔘 The Interaction Flow
-   **Contextual Entry**: Opening the drawer from a field (e.g., `fullName`) auto-generates the function scaffold: `(s, ctx) => { ... }`.
-   **IntelliSense in Browser**: Using Monaco (VS Code engine), the editor provides autocomplete for the `s` object (the subject's actual schema) and the `ctx` object (registry, prng).
-   **Live Result Bubble**: A small, floating overlay next to the editor shows the **live result** of the current function for the *first* subject instance (e.g., *"Result: 'John Doe'"*).
-   **Safety Guard**: If the code contains a syntax error, the "Apply" button is disabled and the preview data shows *"Error: [message]"*.

### 🎨 Visual Language
-   **Split View**: The drawer can be pinned, splitting the screen between the Builder (left) and the Code Editor (right).
-   **Line Correlation**: Clicking a field in the builder highlights the corresponding block of code in the Logic Drawer.

---

## 3. World-Wide Heuristics: Global Rule Editor

For large projects, users need a way to define "global" generation rules (e.g., *"Every field ending in `_at` is a ISO Date"*).

### 🔘 The Interaction Flow
-   **Rule List**: A dedicated section in the Left Rail (World Settings).
-   **The Rule Builder**: 
    -   **Pattern**: A regex or glob (e.g., `*_code`).
    -   **Generator**: A dropdown of presets (UUID, Nanoid, Email) or a "Custom" option that opens the Logic Drawer.
-   **Priority Management**: Drag-and-drop handles allow users to reorder rules. The world processes rules from top to bottom; the first match wins.

### 🎨 Visual Language
-   **Heuristic Badges**: In the Builder, fields matched by a *Custom* heuristic show a unique icon (e.g., a "Magic Wand") to distinguish them from built-in Zod heuristics.

---

## 🏗️ UX Summary Table

| Feature | Interaction | UX "Wining" Moment |
| :--- | :--- | :--- |
| **Field Mapping** | Popover + Search | *"I mapped my entire schema to the subject in 3 clicks."* |
| **Logic Editor** | Monaco + IntelliSense | *"I can write complex lookups with full type safety in the browser."* |
| **Global Rules** | Reorderable List | *"I defined a custom ID format once and it applied everywhere."* |
| **Live Preview** | Inline Bubble | *"I see the data change as I'm typing the function."* |
