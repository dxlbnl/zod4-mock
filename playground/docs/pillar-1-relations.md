# Pillar 1: Relational Modeling & "World View" (UX Deep Dive)

The goal of this pillar is to transform the playground into a **system designer**. The core shift is moving from inspecting isolated data to visualizing a connected "World Graph."

---

## 1. Relationship Manager: The "Wiring" Experience

The UX goal is to make defining complex data graphs feel as simple as connecting dots.

### 🔘 The Interaction Flow

1.  **Trigger**: User clicks a `+` button in the "Relationships" accordion (Left Rail).
2.  **Configuration Popover**: A non-modal popover appears near the button.
    - **Subject A (Source)**: A searchable dropdown. Defaults to the currently active subject.
    - **Subject B (Target)**: A searchable dropdown.
    - **Name**: A text input. **Smart UX**: As the user picks Subject B (e.g., "Company"), the Name field auto-populates with the camelCase version ("company").
    - **Cardinality Toggle**: A segmented control `[ 1 ] [ 0..1 ] [ 0..n ] [ 1..n ]`.
3.  **Real-time Codegen**: As the user types, the `defineSubjectType` code in the preview updates instantly to include the `relations` block.

---

## 2. Population Controls: Managing "World Density"

### 🔘 The Interaction Flow

- **Direct Entry**: Every Subject item in the Left Rail has a visible "Count" badge.
- **Incremental Adjustments**: Users can click the badge to open a small stepper `[-] 10 [+]`.
- **World Stats**: A summary at the bottom showing the total number of objects in the world.

---

## 3. World View: The Graph vs. Table Interface

The "Registry Inspector" is renamed to **World View**. It offers two distinct ways to interact with the generated data: a **World Graph** for structure and a **Data Table** for density.

### 🗺️ The World Graph (Node-Based View)

This is the "hero" view for understanding relationships. Every subject instance is a node in an interactive canvas.

#### **🔘 Interaction Flow**

- **Exploration**: Standard Pan and Zoom (Scroll-to-zoom).
- **Node Selection**:
  - Clicking a node (e.g., `user#1`) selects it and opens the **Property Panel** on the right.
  - The Property Panel shows the full JSON data for that specific instance.
- **Neighbor Highlighting**:
  - Hovering a node dims the rest of the world and highlights only the direct relatives (connected nodes).
  - The connection lines (edges) show the relationship name (e.g., _"is author of"_).
- **Auto-Layout**: A force-directed layout keeps the graph organized, but users can drag nodes to manually rearrange them.

#### **🎨 Visual Language**

- **Node Shapes**: Circles or rounded hexes.
- **Color Coding**: Nodes are colored by Subject Type (e.g., all `User` nodes are Indigo, `Order` nodes are Emerald).
- **Edge Styling**: Subtle dashed lines for `0..1` relations, solid lines for `1`. Arrows indicate the direction of the relation.

---

### 📊 The Data Table (Density View)

For when the user needs to scan hundreds of items or find a specific value.

#### **🔘 Interaction Flow**

- **Teleport**: Clicking a related ID link (e.g., `user#3`) in a row scrolls the table to that user.
- **Peek**: Hovering a related ID shows a condensed preview of that item.

---

## 🏗️ UX Summary Table

| Feature           | Best For                 | Interaction                              |
| :---------------- | :----------------------- | :--------------------------------------- |
| **World Graph**   | Understanding Structure  | Node dragging, Zoom/Pan, Property Panel. |
| **Data Table**    | Validating Specific Data | Search, Filter, Teleport links.          |
| **Relationships** | Designing the Graph      | Smart dropdowns, Cardinality toggles.    |
| **Population**    | Controlling Scale        | Inline steppers in the Left Rail.        |
