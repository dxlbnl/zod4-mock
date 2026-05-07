# Pillar 4: Workflow & DX (UX Deep Dive)

This pillar focuses on turning the playground into a high-productivity workspace. The UX must handle project persistence, real-time validation, and code-syncing.

---

## 1. The "World Health" Bar: Real-time Validation

The UX goal is to ensure the user never exports a "broken" configuration.

### 🔘 The Interaction Flow

- **Static Analysis**: The playground constantly validates the graph. If a `Relationship` points to a deleted `Subject`, a **Red Error** appears in the Status Bar.
- **Direct Fix**: Clicking the error in the Status Bar **"teleports"** the user (scrolling and highlighting) to the exact field or relationship that needs fixing.
- **Circular Warnings**: If a `.derive()` logic depends on its own result, a warning icon appears with a "Logic Loop" explanation.

### 🎨 Visual Language

- **The Status Bar**: A slim bar at the bottom with a pulse indicator (Green = OK, Red = Errors).
- **Inline Squiggles**: Like a code editor, broken fields in the Builder get a subtle red underline.

---

## 2. Unified World Code: The "Source of Truth" View

For developers, the generated TypeScript is the ultimate output. The UX must bridge the gap between the Builder and the Code.

### 🔘 The Interaction Flow

- **"Full View" Toggle**: A button in the Output Pane that expands the code view to show the entire `world.ts` file (Imports, Subjects, Schemas, Population).
- **Synchronized Selection**:
  - Selecting a field in the **Builder** scrolls the **Code View** to that specific line.
  - Clicking a line in the **Code View** (e.g., a subject definition) focuses that subject in the **Left Rail**.
- **The "Ready-to-Use" Export**: A large, satisfying "Copy to Clipboard" button with a "Copied!" toast notification.

### 🎨 Visual Language

- **Syntactic Coloring**: Using the same professional theme as VS Code (Monaco).
- **Collapsible Sections**: In the full view, users can collapse `// ── Subjects` or `// ── World` sections to stay focused.

---

## 3. Persistence & Sharing: "Cloud" UX without a Backend

The playground should feel like it "remembers" you, while allowing for easy collaboration.

### 🔘 The Interaction Flow

- **Auto-Save Heartbeat**: A small "Saved" icon pulses in the Top Bar every time the state changes.
- **The "Share" Experience**:
  - Clicking **Share** compresses the entire state into a URL fragment.
  - The UI generates a short-link and copies it instantly.
- **Import via Drop**: Users can drag and drop a `world.json` file anywhere on the playground to restore a previously saved state.

### 🎨 Visual Language

- **History Stack**: A subtle Undo/Redo pair of icons in the Top Bar.
- **Project Branding**: The top bar clearly shows the current project name (editable), making the workspace feel personal.

---

## 🏗️ UX Summary Table

| Feature          | Interaction      | UX "Winning" Moment                                               |
| :--------------- | :--------------- | :---------------------------------------------------------------- |
| **World Health** | Status Bar Click | _"I found the broken relation instantly and fixed it."_           |
| **Unified Code** | Sync-Scroll      | _"The code view feels like a real IDE, not just a preview."_      |
| **Sharing**      | One-Click URL    | _"I shared my complex world setup with a teammate in 2 seconds."_ |
| **Persistence**  | Auto-Save        | _"I refreshed my browser and my work was still there."_           |
