# Playground Evolution: Pillars of Development

This directory contains the detailed specifications for the future evolution of the `zod4-mock` Playground. Each pillar represents a core area of functionality that will transform the tool from a schema builder into a full-featured mock data ecosystem.

## 🏛️ The Four Pillars

### [1. Relational Modeling & Registry](./pillar-1-relations.md)
Moving from individual schemas to a connected graph of data. Includes relationship management, population controls, and a live registry inspector.

### [2. Advanced Logic & Bindings](./pillar-2-logic.md)
Unlocking the power of the generation pipeline. Includes custom matchers, intra-subject field derivations, and custom key-based generators.

### [3. Execution & Experimentation](./pillar-3-experimentation.md)
A sandbox for power users. Includes overrides, transforms, PRNG visualization, and a deep-dive into field heuristics.

### [4. Workflow & DX](./pillar-4-workflow.md)
Improving the developer lifecycle. Includes real-time validation, unified world code views, and state persistence/sharing.

---

## 🛠️ Implementation Philosophy
- **High Density, Low Noise**: The UI should remain clean and professional, using drawers and tabs to hide complexity until needed.
- **Seeded by Default**: Every action should respect the world seed, ensuring that "what you see is what you get" in the generated code.
- **Visual Evidence**: Always show the *why* behind the data (e.g., highlighting which subject a schema field was derived from).
