<script lang="ts">
	/**
	 * SchemaEditor/index.svelte
	 */

	import Pane from '$lib/components/Surfaces/Pane.svelte';
	import SchemaEditorLine from './SchemaEditorLine.svelte';
	import RelationsManager from './RelationsManager.svelte';
	import WorldConfig from '../Sidebar/WorldConfig.svelte';
	import FancySelect from '$lib/components/Primitives/FancySelect.svelte';
	import NumberInput from '$lib/components/Primitives/NumberInput.svelte';
	import Input from '$lib/components/Primitives/Input.svelte';
	import type { FieldDef, ModifierDef, SchemaDef, PlaygroundStore } from '$lib/state.svelte';
	import { type ZodFieldType } from '$lib/field-types';
	import { tick, getContext } from 'svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		title: string;
		schema: SchemaDef | null;
		schemas: SchemaDef[];
		selectedFieldId?: string | null;
		onselectfield?: (id: string | null) => void;
		
		// World config (for mobile/empty state)
		world?: { seed: number; optionalProbability: number; zodVersion: string };
		availableZodVersions?: string[];
		activeSchemaId?: string | null;
	}

	let {
		title,
		schema = null,
		schemas = [],
		selectedFieldId = null,
		onselectfield,
		world,
		availableZodVersions = [],
		activeSchemaId = null,
	}: Props = $props();

	const store = getContext<PlaygroundStore>('playground-store');

	// ── UI state ──────────────────────────────────────────────────────────
	let lastAddedId = $state<string | null>(null);
	let showSettings = $state(false);
	let configBarEl = $state<HTMLDivElement | null>(null);

	import { onMount } from 'svelte';
	onMount(() => {
		const handleClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const isCogClick = !!target.closest('[data-testid="settings-toggle"]');
			const isInsideSettings = configBarEl?.contains(target);

			if (showSettings && !isInsideSettings && !isCogClick) {
				showSettings = false;
			}
		};
		window.addEventListener('click', handleClick);
		return () => window.removeEventListener('click', handleClick);
	});

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
		if (!schema) return;
		const newId = store.addField(schema.id, parentId);
		if (typeof newId === 'string') {
			lastAddedId = newId;
			await tick();
			onselectfield?.(newId);
		}
	}

	function handleRemoveField(id: string) {
		if (!schema) return;
		const ids = flattenIds(fields);
		const idx = ids.indexOf(id);
		const prevId = idx > 0 ? ids[idx - 1] : ids[idx + 1] ?? null;
		store.removeField(schema.id, id);
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
		if (!schema) return;
		const isGroup = type === 'object';
		store.updateField(schema.id, id, { type, kind: isGroup ? 'group' : 'field' });
		if (type === 'object') {
			tick().then(() => handleAddField(id));
		}
	}
	const mobileOptions = $derived([
		{ label: '🌍 World Config', value: 'world' },
		...schemas.map(s => ({ label: `📄 ${s.name}`, value: s.id })),
		{ label: '➕ Add Schema', value: 'add' }
	]);
</script>

{#snippet titleSnippet()}
	<div class="header-switcher">
		<FancySelect
			class="header-dropdown"
			options={mobileOptions}
			value={activeSchemaId ?? 'world'}
			variant="ghost"
			triggerClass="t-title"
			onchange={(val) => {
				if (val === 'add') {
					store.addSchema('NewSchema');
				} else {
					store.setActiveSchema(val === 'world' ? null : val);
				}
			}}
		/>
		<div class="desktop-title">
			<span class="pane-title t-title">{title}</span>
		</div>
	</div>
{/snippet}

<Pane 
	{titleSnippet} 
	onsettings={schema ? (e) => { e.stopPropagation(); showSettings = !showSettings; } : undefined}
	isSettingsActive={showSettings}
>
	<div class="schema-editor" data-testid="active-schema-editor">
		{#if schema}
			<!-- Config Bar (Collapsible) -->
			{#if showSettings}
				<div 
					bind:this={configBarEl}
					class="config-bar" 
					transition:slide={{ duration: 200 }}
				>
					<div class="config-row">
						<div class="config-item">
							<label for="schema-name-settings" class="t-eyebrow">Schema Name</label>
							<Input 
								id="schema-name-settings"
								value={schema.name} 
								oninput={(e) => store.renameSchema(schema.id, e.currentTarget.value)}
							/>
						</div>
						<div class="config-item">
							<label for="populate-count" class="t-eyebrow">Populate</label>
							<NumberInput 
								id="populate-count"
								value={schema.populateCount} 
								onchange={(val) => store.setPopulateCount(schema.id, val)}
								min={0}
							/>
						</div>
					</div>
					<div class="config-row">
						<div class="config-item">
							<label for="derived-from" class="t-eyebrow">Derived From</label>
							<FancySelect
								id="derived-from"
								options={[{ label: 'None (Independent)', value: '' }, ...schemas.filter(s => s.id !== schema?.id).map(s => ({ label: s.name, value: s.id }))]}
								value={schema.derivedFrom ?? ''}
								onchange={(val) => store.setDerivedFrom(schema.id, val || undefined)}
							/>
						</div>
					</div>

					<div class="config-row">
						<div class="config-item full">
							<span class="label">Relations</span>
							<RelationsManager 
								{schema} 
								{schemas} 
								onadd={(target, name) => store.addSchemaRelation(schema.id, target, name)} 
								onremove={(name) => store.removeSchemaRelation(schema.id, name)} 
							/>
						</div>
					</div>

					<div class="config-row danger-zone">
						<button 
							class="btn danger t-eyebrow" 
							style="width: 140px; height: var(--h-btn);"
							onclick={() => {
								store.removeSchema(schema.id);
								showSettings = false;
							}}
						>
							Delete Schema
						</button>
					</div>
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
		{:else}
			<div class="world-config-body">
				<WorldConfig 
					seed={world?.seed ?? 0}
					optionalProbability={world?.optionalProbability ?? 0}
					onupdateseed={(v) => store.setWorldSeed(v)}
					onupdateprob={(v) => store.setOptionalProbability(v)}
					zodVersion={world?.zodVersion}
					{availableZodVersions}
					onchangezod={(v) => store.setZodVersion(v)}
				/>
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

				onupdatetype={handleUpdateType}

				onremove={handleRemoveField}
				onnextsibling={handleNextSibling}
				onexitnesting={handleExitNesting}
				onfocus={(id) => onselectfield?.(id)}
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
		height: 100%;
		position: relative;
	}

	.header-switcher {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		height: 100%;
	}

	.desktop-title {
		padding-left: var(--space-5);
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
	}

	:global(.header-dropdown) {
		display: none !important;
		width: auto !important;
		min-width: 140px;
		height: 100%;
	}

	@media (max-width: 768px) {
		:global(.header-dropdown) {
			display: block !important;
			flex: 1;
			width: 100% !important;
			height: 100%;
		}
		.desktop-title {
			display: none;
		}
	}


	.config-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--bg-1);
		border-bottom: 1px solid var(--line-strong);
		z-index: 10;
		box-shadow: var(--shadow-pop);
	}

	.config-row {
		display: flex;
		gap: var(--space-4);
	}

	.config-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: none;
	}
	.config-item.full { width: 100%; max-width: 400px; }
	.config-item :global(.input), .config-item :global(.fancy-select), .config-item :global(.number-input) {
		width: 180px;
	}
	.config-item.full :global(.fancy-select) {
		width: 100%;
	}

	.config-item label {
		margin-bottom: var(--space-1);
	}

	/* input styles are global */

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

	.danger-zone {
		margin-top: var(--space-2);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	.world-config-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding: var(--space-4);
	}
</style>
