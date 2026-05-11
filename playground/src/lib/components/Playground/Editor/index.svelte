<script lang="ts">
	/**
	 * SchemaEditor/index.svelte
	 */

	import Pane from '$lib/components/Surfaces/Pane.svelte';
	import SchemaEditorLine from './SchemaEditorLine.svelte';
	import RelationsManager from './RelationsManager.svelte';
	import WorldConfig from '../Sidebar/WorldConfig.svelte';
	import FancySelect from '$lib/components/Primitives/FancySelect.svelte';
	import type { FieldDef, ModifierDef, SchemaDef } from '$lib/state.svelte';
	import { type ZodFieldType } from '$lib/field-types';
	import { tick } from 'svelte';

	interface Props {
		schema: SchemaDef | null;
		schemas: SchemaDef[];
		title: string;

		onaddfield?: (parentId?: string) => string | void;
		onremovefield?: (id: string) => void;
		onupdatefield?: (id: string, patch: Partial<FieldDef>) => void;
		onaddmodifier?: (fieldId: string, mod: ModifierDef) => void;
		onupdatemodifier?: (fieldId: string, index: number, value: string | number | boolean) => void;
		onremovemodifier?: (fieldId: string, index: number) => void;
		onupdateenumvalues?: (fieldId: string, values: string[]) => void;
		onselectfield?: (id: string | null) => void;
		selectedFieldId?: string | null;
		onupdatetitle?: (val: string) => void;
		onupdatepopulate?: (val: number) => void;

		onupdatederived?: (sourceId: string | undefined) => void;
		onaddrelation?: (targetId: string, name: string) => void;
		onremoverelation?: (name: string) => void;

		onupdateseed?: (val: number) => void;
		onupdateprob?: (val: number) => void;

		// Mobile context
		activeSchemaId?: string | null;
		onaddschema?: () => void;
		onselectschema?: (id: string | null) => void;
	}

	let {
		schema = null,
		schemas = [],
		title,
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
		onupdatepopulate,
		onupdatederived,
		onaddrelation,
		onremoverelation,
		world,
		onupdateseed,
		onupdateprob,
		activeSchemaId = null,
		onaddschema,
		onselectschema
	}: Props = $props();

	// ── Active line tracking ───────────────────────────────────────────────
	let lastAddedId = $state<string | null>(null);

	const fields = $derived(schema?.fields ?? []);
	const sourceSchema = $derived(schemas.find(s => s.id === schema?.derivedFrom));

	// ── Field helpers ──────────────────────────────────────────────────────

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
		const ids = flattenIds(fields);
		const idx = ids.indexOf(id);
		const prevId = idx > 0 ? ids[idx - 1] : ids[idx + 1] ?? null;
		onremovefield?.(id);
		tick().then(() => {
			onselectfield?.(prevId);
		});
	}

	function handleNextSibling(id: string) {
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
		const grandparentId = ancestors && ancestors.length >= 2 ? ancestors[ancestors.length - 2] : undefined;
		handleAddField(grandparentId);
	}

	function handleUpdateType(id: string, type: ZodFieldType) {
		const isGroup = type === 'object';
		onupdatefield?.(id, { type, kind: isGroup ? 'group' : 'field' });
		if (type === 'object') {
			tick().then(() => handleAddField(id));
		}
	}
	const mobileOptions = $derived([
		{ label: '🌍 World Config', value: 'world' },
		...schemas.map(s => ({ label: `📄 ${s.name}`, value: s.id })),
		{ label: '➕ Add Schema', value: 'add' }
	]);

	function handleMobileSwitch(val: string) {
		if (val === 'add') {
			onaddschema?.();
		} else {
			onselectfield?.(null); // Clear selected field
			onupdatederived?.(undefined); // Unused here but to be safe
			// Wait, I need a way to tell the parent to switch active schema
			// I'll add onselectschema to props
		}
	}
</script>

{#snippet actions()}
	<div class="mobile-switcher">
		<FancySelect
			options={mobileOptions}
			value={activeSchemaId ?? 'world'}
			onchange={(val) => {
				if (val === 'add') {
					onaddschema?.();
				} else {
					onselectschema?.(val === 'world' ? null : val);
				}
			}}
		/>
	</div>
{/snippet}

<Pane {title} onupdatetitle={onupdatetitle} titleTestId="schema-name-input" {actions}>
	<div class="schema-editor" data-testid="active-schema-editor">
		{#if schema}
			<!-- Config Bar -->
			<div class="config-bar">
				<div class="config-row">
					<div class="config-item">
						<label for="populate-count">Populate</label>
						<input 
							id="populate-count"
							type="number" 
							value={schema.populateCount} 
							oninput={(e) => onupdatepopulate?.(parseInt(e.currentTarget.value) || 0)}
							min="0"
						/>
					</div>
					<div class="config-item">
						<label for="derived-from">Derived From</label>
						<FancySelect
							options={[
								{ label: 'None (Independent)', value: '' },
								...schemas
									.filter(s => s.id !== schema?.id)
									.map(s => ({ label: s.name, value: s.id }))
							]}
							value={schema.derivedFrom ?? ''}
							onchange={(val) => onupdatederived?.(val || undefined)}
						/>
					</div>
				</div>

				<div class="config-row">
					<div class="config-item full">
						<span class="label">Relations</span>
						<RelationsManager 
							{schema} 
							{schemas} 
							onadd={onaddrelation!} 
							onremove={onremoverelation!} 
						/>
					</div>
				</div>
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
		{:else}
			<div class="world-config-container">
				<Pane title="World Config" subtitle="Global Mock Settings">
					<div class="world-config-body">
						<WorldConfig 
							seed={world?.seed ?? 0}
							optionalProbability={world?.optionalProbability ?? 0}
							onupdateseed={onupdateseed}
							onupdateprob={onupdateprob}
						/>
						
						<div class="config-section extra">
							<span class="t-small section-label">Zod Version</span>
							<div class="zod-info t-code-sm">
								Currently using <strong>zod@{world?.zodVersion}</strong>
							</div>
							<p class="help t-code-tight">Change version in the top bar.</p>
						</div>
					</div>
				</Pane>
			</div>
		{/if}
	</div>
</Pane>

{#snippet lineList(list: FieldDef[], parentId: string | undefined)}
	{#each list as field (field.id)}
		<div role="listitem">
			<SchemaEditorLine
				{field}
				isActive={selectedFieldId === field.id}
				autofocus={lastAddedId === field.id}
				
				{schemas}
				sourceSchema={sourceSchema}
				currentSchemaRelations={schema?.relations ?? []}

				onupdatekey={(id: string, key: string) => onupdatefield?.(id, { key })}
				onupdatetype={handleUpdateType}
				onaddmodifier={(id: string, mod: ModifierDef) => onaddmodifier?.(id, mod)}
				onupdatemodifier={(id: string, idx: number, val: string | number | boolean) => onupdatemodifier?.(id, idx, val)}
				onremovemodifier={(id: string, idx: number) => onremovemodifier?.(id, idx)}
				onupdateenumvalues={(id: string, vals: string[]) => onupdateenumvalues?.(id, vals)}
				
				onupdatemapping={(patch: Partial<FieldDef>) => onupdatefield?.(field.id, patch)}

				onremove={handleRemoveField}
				onnextsibling={handleNextSibling}
				onexitnesting={handleExitNesting}
				onfocus={(id: string | null) => onselectfield?.(id)}
			/>

			{#if field.kind === 'group' && field.children?.length}
				<div class="nested-lines" role="list" aria-label="Nested fields of {field.key}">
					{@render lineList(field.children, field.id)}
				</div>
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

	.mobile-switcher {
		display: none;
		min-width: 160px;
	}

	@media (max-width: 768px) {
		.mobile-switcher {
			display: block;
		}
	}

	.config-bar {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--bg-1);
		border-bottom: 1px solid var(--line-strong);
	}

	.config-row {
		display: flex;
		gap: var(--space-4);
	}

	.config-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1;
	}
	.config-item.full { flex: none; width: 100%; }

	.config-item label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--ink-3);
		letter-spacing: 0.05em;
	}

	input {
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		color: var(--ink-1);
		font-family: inherit;
		font-size: 13px;
	}

	input:focus {
		outline: none;
		border-color: var(--accent-bright);
	}

	.lines {
		flex: 1;
		overflow-y: auto;
	}

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

	.section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--ink-3);
		letter-spacing: 0.05em;
		margin-bottom: var(--space-1);
	}

	.zod-info {
		padding: var(--space-2) var(--space-3);
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		color: var(--ink-1);
	}
</style>
