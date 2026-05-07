<script lang="ts">
	/**
	 * SchemaEditor/index.svelte
	 * Root component — drop-in replacement for BuilderPane.
	 *
	 * Renders a list of SchemaEditorLines (and recursively nested ones for groups),
	 * manages cross-line navigation and field creation/removal.
	 */

	import Pane from '../Surfaces/Pane.svelte';
	import SchemaEditorLine from './SchemaEditorLine.svelte';
	import type { FieldDef, ModifierDef } from '../../state.svelte';
	import { makeField } from '../../state.svelte';
	import { FIELD_TYPES, type ZodFieldType } from '../../field-types';
	import { tick } from 'svelte';

	interface Props {
		fields: FieldDef[];
		title: string;
		accentTitle?: string;
		subtitle?: string;

		onaddfield?: (parentId?: string) => string | void;
		onremovefield?: (id: string) => void;
		onupdatefield?: (id: string, patch: Partial<FieldDef>) => void;
		onaddmodifier?: (fieldId: string, mod: ModifierDef) => void;
		onupdatemodifier?: (fieldId: string, index: number, value: string | number | boolean) => void;
		onremovemodifier?: (fieldId: string, index: number) => void;
		onupdateenumvalues?: (fieldId: string, values: string[]) => void;
		/** Notify parent of selection change */
		onselectfield?: (id: string | null) => void;
		/** Currently selected field ID (controlled from parent) */
		selectedFieldId?: string | null;
	}

	let {
		fields = [],
		title,
		accentTitle,
		subtitle,
		onaddfield,
		onremovefield,
		onupdatefield,
		onaddmodifier,
		onupdatemodifier,
		onremovemodifier,
		onupdateenumvalues,
		onselectfield,
		selectedFieldId = null
	}: Props = $props();

	// ── Active line tracking ───────────────────────────────────────────────
	let activeLineId = $derived(selectedFieldId);
	let lastAddedId = $state<string | null>(null);

	// ── Field helpers ──────────────────────────────────────────────────────

	/** Collect all field IDs in render order (flattened, DFS) */
	function flattenIds(list: FieldDef[]): string[] {
		const ids: string[] = [];
		for (const f of list) {
			ids.push(f.id);
			if (f.children?.length) ids.push(...flattenIds(f.children));
		}
		return ids;
	}

	async function handleAddField(parentId?: string) {
		const newId = onaddfield?.(parentId);
		if (typeof newId === 'string') {
			lastAddedId = newId;
			await tick();
			onselectfield?.(newId);
		}
	}

	function handleRemoveField(id: string) {
		// Before removing, try to focus the previous line
		const ids = flattenIds(fields);
		const idx = ids.indexOf(id);
		const prevId = idx > 0 ? ids[idx - 1] : ids[idx + 1] ?? null;
		onremovefield?.(id);
		tick().then(() => {
			onselectfield?.(prevId);
		});
	}

	function handleNextSibling(id: string) {
		// Find the parent list that contains this field
		function findParentId(list: FieldDef[], targetId: string, parentId?: string): string | undefined {
			for (const f of list) {
				if (f.id === targetId) return parentId;
				if (f.children?.length) {
					const found = findParentId(f.children, targetId, f.id);
					if (found !== undefined) return found;
				}
			}
			return undefined;
		}
		const parentId = findParentId(fields, id);
		handleAddField(parentId);
	}

	function handleExitNesting(id: string) {
		// Find the parent's parent and add a sibling there
		function findAncestorId(list: FieldDef[], targetId: string, ancestors: string[]): string[] | null {
			for (const f of list) {
				if (f.id === targetId) return ancestors;
				if (f.children?.length) {
					const found = findAncestorId(f.children, targetId, [...ancestors, f.id]);
					if (found) return found;
				}
			}
			return null;
		}
		const ancestors = findAncestorId(fields, id, []);
		// ancestors = [...grandparent, parent]. We want to add after parent.
		const grandparentId = ancestors && ancestors.length >= 2 ? ancestors[ancestors.length - 2] : undefined;
		handleAddField(grandparentId);
	}

	function handleUpdateType(id: string, type: ZodFieldType) {
		const isGroup = type === 'object' || type === 'array';
		onupdatefield?.(id, { type, kind: isGroup ? 'group' : 'field' });

		// Auto-spawn a child for object types
		if (type === 'object') {
			tick().then(() => handleAddField(id));
		}
	}

	function handleUpdateElementType(id: string, type: ZodFieldType) {
		// Store element type in the first child's type field
		// If no child exists, create one
		const field = findFieldInList(fields, id);
		if (!field) return;

		if (field.children?.length > 0) {
			onupdatefield?.(field.children[0].id, { type });
		} else {
			// Add a child with the given type, then update it
			const newId = onaddfield?.(id);
			if (typeof newId === 'string') {
				tick().then(() => onupdatefield?.(newId, { type }));
			}
		}
	}

	function findFieldInList(list: FieldDef[], id: string): FieldDef | null {
		for (const f of list) {
			if (f.id === id) return f;
			if (f.children?.length) {
				const found = findFieldInList(f.children, id);
				if (found) return found;
			}
		}
		return null;
	}
</script>

<Pane {title} {accentTitle} {subtitle}>
	<div class="schema-editor">
		<!-- Header hint bar -->
		<div class="hint-bar t-code-tight" aria-label="Keyboard shortcuts">
			<span><kbd>:</kbd> type</span>
			<span><kbd>.</kbd> modifier</span>
			<span><kbd>↵</kbd> next field</span>
			<span><kbd>⇧↵</kbd> exit nest</span>
			<span><kbd>⌫</kbd> delete</span>
		</div>

		<!-- Field lines -->
		<div class="lines" role="list" aria-label="Schema fields">
			{@render lineList(fields, undefined)}
		</div>

		<!-- Add property button -->
		<div class="add-row">
			<button
				type="button"
				class="add-btn t-code-sm"
				onclick={() => handleAddField()}
			>
				<span class="plus" aria-hidden="true">+</span> add property
			</button>
		</div>
	</div>
</Pane>

{#snippet lineList(list: FieldDef[], parentId: string | undefined)}
	{#each list as field (field.id)}
		<div role="listitem">
			<SchemaEditorLine
				{field}
				isActive={activeLineId === field.id}
				autofocus={lastAddedId === field.id}
				onupdatekey={(id, key) => onupdatefield?.(id, { key })}
				onupdatetype={handleUpdateType}
				onupdateelementtype={handleUpdateElementType}
				onaddmodifier={(id, mod) => onaddmodifier?.(id, mod)}
				onupdatemodifier={(id, idx, val: string | number | boolean) => onupdatemodifier?.(id, idx, val)}
				onremovemodifier={(id, idx) => onremovemodifier?.(id, idx)}
				onupdateenumvalues={(id, vals) => onupdateenumvalues?.(id, vals)}
				onremove={handleRemoveField}
				onnextsibling={handleNextSibling}
				onexitnesting={handleExitNesting}
				onfocus={(id) => onselectfield?.(id)}
			/>

			<!-- Nested children for group fields -->
			{#if field.kind === 'group' && field.children?.length}
				<div class="nested-lines" role="list" aria-label="Nested fields of {field.key}">
					{@render lineList(field.children, field.id)}
				</div>
				<!-- Nested add button -->
				<div class="nested-add" style="--ind: {12 + (field.indent + 1) * 20}px">
					<button
						type="button"
						class="nested-add-btn t-code-tight"
						onclick={() => handleAddField(field.id)}
					>+ add property</button>
				</div>
			{/if}
		</div>
	{/each}
{/snippet}

<style>
	.schema-editor {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Keyboard hint bar */
	.hint-bar {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--bg-2);
		color: var(--ink-3);
		background: var(--bg-2);
		flex-wrap: wrap;
	}

	.hint-bar kbd {
		display: inline-block;
		padding: 0 4px;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--bg-1);
		color: var(--ink-1);
		font-size: 0.85em;
		font-family: inherit;
		line-height: 1.5;
	}

	/* Lines */
	.lines {
		flex: 1;
		overflow-y: auto;
	}

	/* Nested add button */
	.nested-add {
		padding: var(--space-1) var(--space-4) var(--space-1) var(--ind);
		border-bottom: 1px solid var(--bg-2);
	}

	.nested-add-btn {
		background: transparent;
		border: none;
		color: var(--ink-3);
		cursor: pointer;
		padding: 2px 0;
		transition: color var(--ease-quick);
	}

	.nested-add-btn:hover {
		color: var(--accent);
	}

	/* Add row */
	.add-row {
		padding: var(--space-4);
	}

	.add-btn {
		width: 100%;
		height: 40px;
		background: transparent;
		border: 1px dashed var(--bg-3);
		color: var(--ink-2);
		border-radius: var(--radius-md);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		transition: all var(--ease-quick);
	}

	.add-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-soft);
	}

	.plus {
		font-size: 1.2em;
		line-height: 0;
		margin-bottom: 2px;
	}
</style>
