<script lang="ts">
	/**
	 * SchemaEditor/index.svelte
	 * Root component — drop-in replacement for BuilderPane.
	 *
	 * Renders a list of SchemaEditorLines (and recursively nested ones for groups),
	 * manages cross-line navigation and field creation/removal.
	 */

	import Pane from '$lib/components/Surfaces/Pane.svelte';
	import SchemaEditorLine from './SchemaEditorLine.svelte';
	import InlineDropdown from './InlineDropdown.svelte';
	import type { FieldDef, ModifierDef } from '$lib/state.svelte';
	import { makeField } from '$lib/state.svelte';
	import { FIELD_TYPES, type ZodFieldType } from '$lib/field-types';
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
		onupdatetitle?: (val: string) => void;

		/** Binding related (Story 3) */
		activeEntityType?: 'subject' | 'schema';
		subjects?: import('$lib/state.svelte').SubjectDef[];
		activeBinding?: import('$lib/state.svelte').SchemaBinding | null;
		relationships?: import('$lib/state.svelte').RelationshipDef[];
		onbindschema?: (subjectId: string | null) => void;
		onsetmapping?: (fieldKey: string, subjectKey: string) => void;
		onremovemapping?: (fieldKey: string) => void;
		onupdaterelationmapping?: (fieldId: string, relationName: string | undefined) => void;
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
		selectedFieldId = null,
		onupdatetitle,
		activeEntityType,
		subjects = [],
		relationships = [],
		activeBinding = null,
		onbindschema,
		onsetmapping,
		onremovemapping,
		onupdaterelationmapping
	}: Props = $props();

	// ── Subject Picker State ───────────────────────────────────────────────
	let activeAnchorEl = $state<HTMLElement | null>(null);
	let subjectDropdownOpen = $state(false);
	const boundSubject = $derived(subjects.find((s) => s.id === activeBinding?.subjectId) ?? null);
	const subjectMenuItems = $derived([
		...subjects.map((s) => ({
			name: s.name,
			desc: '',
			category: 'Subjects'
		})),
		{ name: 'None', desc: 'Clear binding', category: 'Action' }
	]);

	function handleBindSchema(subjectName: string) {
		if (subjectName === 'None') {
			onbindschema?.(null);
		} else {
			const subj = subjects.find((s) => s.name === subjectName);
			if (subj) onbindschema?.(subj.id);
		}
		subjectDropdownOpen = false;
	}

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
		const isGroup = type === 'object';
		onupdatefield?.(id, { type, kind: isGroup ? 'group' : 'field' });

		// Auto-spawn a child for object types
		if (type === 'object') {
			tick().then(() => handleAddField(id));
		}
	}


</script>

<Pane {title} {accentTitle} {subtitle} {onupdatetitle}>
	<div class="schema-editor">
		<!-- Header hint bar -->
		<div class="hint-bar t-code-tight" aria-label="Keyboard shortcuts">
			<span><kbd>:</kbd> type</span>
			<span><kbd>.</kbd> modifier</span>
			<span><kbd>↵</kbd> next field</span>
			<span><kbd>⇧↵</kbd> exit nest</span>
			<span><kbd>⌫</kbd> delete</span>
		</div>

		<!-- Subject Relations (Story 5) -->
		{#if activeEntityType === 'subject'}
			{@const subjRels = relationships.filter(r => r.from === title)}
			{#if subjRels.length > 0}
				<div class="relations-bar t-code-tight">
					<span class="label">Relations:</span>
					<div class="rel-tags">
						{#each subjRels as rel}
							<div class="rel-tag" title="{rel.relationName} -> {rel.to} ({rel.cardinality}){rel.key ? ` via ${rel.key}` : ''}">
								<span class="rel-name">{rel.relationName}</span>
								<span class="rel-arrow">→</span>
								<span class="rel-to">{rel.to}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- Subject Picker (Story 3) -->
		{#if activeEntityType === 'schema'}
			<div class="binding-bar t-code-tight">
				<span class="label">Identity Source:</span>
				<div class="picker-container" style="position: relative;">
					<button
						type="button"
						class="picker-btn"
						class:is-bound={!!boundSubject}
						onclick={(e) => {
							if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
							activeAnchorEl = e.currentTarget as HTMLElement;
							activeAnchorEl.style.setProperty('anchor-name', '--subject-picker-anchor');
							subjectDropdownOpen = true;
						}}
					>
						{#if boundSubject}
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="link-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
							<span class="subject-name">{boundSubject.name}</span>
						{:else}
							<span class="unbound-label">Not bound</span>
						{/if}
						<span class="chevron">▾</span>
					</button>

					{#if subjectDropdownOpen}
						<InlineDropdown
							items={subjectMenuItems}
							value={activeBinding?.subjectId}
							scope="subject"
							anchorName="--subject-picker-anchor"
							onselect={handleBindSchema}
							onclose={() => (subjectDropdownOpen = false)}
						/>
					{/if}
				</div>
				{#if boundSubject}
					<span class="hint">Fields can now map to {boundSubject.name} data.</span>
				{:else}
					<span class="hint">Bind to a subject to enable stable identity.</span>
				{/if}
			</div>
		{/if}

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
				subjects={subjects}
				{relationships}
				isActive={activeLineId === field.id}
				autofocus={lastAddedId === field.id}
				availableSourceKeys={boundSubject?.fields.map((f) => f.key) ?? []}
				mappedSourceKey={activeBinding?.fieldMap[field.key] ?? null}
				onupdatekey={(id, key) => onupdatefield?.(id, { key })}
				onupdatetype={handleUpdateType}
				onaddmodifier={(id, mod) => onaddmodifier?.(id, mod)}
				onupdatemodifier={(id, idx, val) => onupdatemodifier?.(id, idx, val)}
				onremovemodifier={(id, idx) => onremovemodifier?.(id, idx)}
				onupdateenumvalues={(id, vals) => onupdateenumvalues?.(id, vals)}
				onsetmapping={(id, schemaKey, subjKey) => onsetmapping?.(schemaKey, subjKey)}
				onremovemapping={(id, schemaKey) => onremovemapping?.(schemaKey)}
				onupdaterelationmapping={(id, rid) => onupdaterelationmapping?.(id, rid)}
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

	/* Binding bar */
	.binding-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		background: var(--bg-1);
		border-bottom: 1px solid var(--line-strong);
		color: var(--ink-2);
	}

	.binding-bar .label {
		color: var(--ink-3);
		font-weight: 500;
	}

	.picker-btn {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px 8px;
		background: var(--bg-2);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		color: var(--ink-1);
		cursor: pointer;
		transition: all var(--ease-quick);
	}

	.picker-btn:hover {
		background: var(--bg-3);
		border-color: var(--ink-3);
	}

	.picker-btn.is-bound {
		color: var(--accent-bright);
		background: var(--accent-soft);
		border-color: var(--accent-edge);
	}

	.picker-btn .link-icon {
		opacity: 0.8;
	}

	.picker-btn .chevron {
		font-size: 0.8em;
		opacity: 0.5;
	}

	.binding-bar .hint {
		font-size: 0.9em;
		color: var(--ink-3);
		opacity: 0.7;
		font-style: italic;
	}

	/* Relations Bar (Story 5) */
	.relations-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		background: var(--bg-1);
		border-bottom: 1px solid var(--line-strong);
		color: var(--ink-2);
	}

	.relations-bar .label {
		color: var(--ink-3);
		font-weight: 500;
	}

	.rel-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.rel-tag {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		cursor: help;
		transition: all var(--ease-quick);
	}

	.rel-tag:hover {
		border-color: var(--accent-edge);
		background: var(--accent-soft);
	}

	.rel-name {
		color: var(--accent-bright);
		font-weight: 600;
	}

	.rel-arrow {
		color: var(--ink-3);
		font-size: 10px;
	}

	.rel-to {
		color: var(--ink-1);
		font-weight: 500;
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
