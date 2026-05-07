/**
 * schema-editor.types.ts
 * Cursor and phase state types for the inline SchemaEditor component.
 */

/**
 * Which "slot" within a single field line has focus/is being edited.
 *
 * name        → the key input is focused
 * type        → the type picker dropdown is open
 * elementType → (array only) the element-type picker dropdown is open
 * enumTags    → the enum value tag area is active
 * modifiers   → the modifier area (after all pills); pressing '.' opens dropdown
 * modifierPicker → a modifier replacement/add dropdown is open
 * modifierArg → an inline argument input for a modifier is active
 */
export type EditorPhase =
  | "name"
  | "type"
  | "elementType"
  | "enumTags"
  | "modifiers"
  | "modifierPicker"
  | "modifierArg";

export interface LineEditorState {
  fieldId: string;
  phase: EditorPhase;
  /** For modifierArg / modifierPicker — which modifier index is active */
  activeModifierIndex: number | null;
}

export interface EditorState {
  /** The fieldId of the line that currently owns focus, or null */
  activeLine: string | null;
  lines: Record<string, LineEditorState>;
}
