/**
 * output.svelte.ts
 * Derived reactive state for playground outputs (code, data previews).
 */

import {
  generateTokenizedCode,
  generateTokenizedData,
  generateTokenizedWorldData,
  generateFullExport,
  generateSchemaCode,
  generateTokenizedFullExport,
} from "./codegen";
import { generateSchemaPreview, generateWorldData } from "./schema-builder";
import type { PlaygroundStore } from "./state.svelte";

export function createOutputState(store: PlaygroundStore) {
  // Derived schema code lines
  const codeLines = $derived.by(() => {
    const activeSchema = store.activeSchema;
    if (activeSchema) {
      return generateTokenizedCode(activeSchema);
    }
    return [];
  });

  // Mock data generation (per schema)
  const generationResult = $derived.by(() => {
    const activeSchema = store.activeSchema;
    if (activeSchema) {
      return generateSchemaPreview(store.state, activeSchema.id);
    }
    return { ok: false };
  });

  // Derived preview data lines
  const dataLines = $derived.by(() => {
    const res = generationResult;
    const activeFields = store.activeFields;
    if (res.ok && activeFields.length > 0) {
      return generateTokenizedData(res.data, activeFields);
    }
    return [];
  });

  // World-wide generation result
  const worldResult = $derived.by(() => {
    return generateWorldData(store.state);
  });

  // Derived world data lines
  const worldLines = $derived.by(() => {
    const res = worldResult;
    if (res.ok) {
      return generateTokenizedWorldData(res.data as Record<string, any[]>);
    }
    return [];
  });

  // Full export code string
  const fullExportCode = $derived.by(() => {
    return generateFullExport(store.state);
  });

  // Tokenized export lines for the export sheet
  const exportLines = $derived.by(() => {
    return generateTokenizedFullExport(store.state);
  });

  // Helpers for full raw strings (used by OutputPane)
  const fullSchemaCode = $derived.by(() => {
    return store.activeSchema ? generateSchemaCode(store.activeSchema) : "";
  });

  const fullDataJson = $derived.by(() => {
    return generationResult.ok ? JSON.stringify(generationResult.data, null, 2) : "";
  });

  const fullWorldJson = $derived.by(() => {
    return worldResult.ok ? JSON.stringify(worldResult.data, null, 2) : "";
  });

  return {
    get codeLines() {
      return codeLines;
    },
    get generationResult() {
      return generationResult;
    },
    get dataLines() {
      return dataLines;
    },
    get worldResult() {
      return worldResult;
    },
    get worldLines() {
      return worldLines;
    },
    get fullExportCode() {
      return fullExportCode;
    },
    get exportLines() {
      return exportLines;
    },
    get fullSchemaCode() {
      return fullSchemaCode;
    },
    get fullDataJson() {
      return fullDataJson;
    },
    get fullWorldJson() {
      return fullWorldJson;
    },
  };
}

export type OutputStore = ReturnType<typeof createOutputState>;
