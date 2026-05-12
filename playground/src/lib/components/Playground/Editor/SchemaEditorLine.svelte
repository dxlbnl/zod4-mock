<script lang="ts">
	/**
	 * SchemaEditorLine.svelte
	 */

	import InlineDropdown from './InlineDropdown.svelte';
	import InlineArgInput from './InlineArgInput.svelte';
	import EnumTagInput from './EnumTagInput.svelte';
	import type { EditorPhase } from './schema-editor.types';
	import type { FieldDef, ModifierDef, SchemaDef, SchemaRelation, PlaygroundStore } from '$lib/state.svelte';
	import {
		FIELD_TYPES,
		SELECTABLE_FIELD_TYPES,
		getModifiers,
		type ZodFieldType
	} from '$lib/field-types';
	import { tick, getContext } from 'svelte';

	import { findMatchingRelation } from '$lib/utils/relations';

	interface Props {
		field: FieldDef;
		isActive?: boolean;
		autofocus?: boolean;

		schemas: SchemaDef[];
		sourceSchema?: SchemaDef;
		currentSchemaRelations: SchemaRelation[];

		onremove: (id: string) => void;
		onnextsibling: (id: string) => void;
		onexitnesting: (id: string) => void;
		onfocus?: (id: string) => void;

		// Handlers moved to store, but kept as on* for local logic if needed
		onupdatetype: (id: string, type: ZodFieldType) => void;
	}

	let {
		field,
		isActive = false,
		autofocus = false,
		schemas,
		sourceSchema,
		currentSchemaRelations,
		onremove,
		onnextsibling,
		onexitnesting,
		onfocus,
		onupdatetype,
	}: Props = $props();

	const store = getContext<PlaygroundStore>('playground-store');

	// ── Phase / dropdown state ─────────────────────────────────────────────
	let phase = $state<EditorPhase | 'mapping'>('name');
	let dropdownOpen = $state<'type' | 'modifier' | 'mapping' | null>(null);
	let editingModifierIndex = $state<number | null>(null);
	let replacingModifierIndex = $state<number | null>(null);
	let activeAnchorEl = $state<HTMLElement | null>(null);

	// ── DOM refs ───────────────────────────────────────────────────────────
	let keyInputEl = $state<HTMLInputElement | null>(null);
	let typeChipEl = $state<HTMLElement | null>(null);
	let modAreaEl = $state<HTMLElement | null>(null);

	// ── Derived ───────────────────────────────────────────────────────────
	const spec = $derived(FIELD_TYPES[field.type] ?? null);
	const isGroup = $derived(field.type === 'object');
	const isEnum = $derived(field.type === 'enum');
	const availableMods = $derived(getModifiers(field.type));

	const typeMenuItems = SELECTABLE_FIELD_TYPES.map((t) => ({
		name: t,
		desc: FIELD_TYPES[t].zodExpr,
		category: 'Zod Types'
	}));

	const modifierMenuItems = $derived(
		availableMods
			.filter((m) => !field.modifiers.some((fm) => fm.name === m.name))
			.map((m) => ({
				name: m.name,
				desc: m.desc,
				category: m.category
			}))
	);

	const heuristicMatch = $derived(
		(!field.sourceMapping && !field.relationMapping)
			? findMatchingRelation(field.key, currentSchemaRelations, schemas)
			: undefined
	);

	const mappingMenuItems = $derived.by(() => {
		const items: any[] = [];
		
		if (sourceSchema) {
			for (const f of sourceSchema.fields) {
				items.push({ name: `src:${f.key}`, desc: `Map to ${sourceSchema.name}.${f.key}`, category: 'Source Schema' });
			}
		}

		for (const rel of currentSchemaRelations) {
			const target = schemas.find(s => s.id === rel.targetSchemaId);
			if (target) {
				for (const tf of target.fields) {
					items.push({ 
						name: `rel:${rel.name}:${tf.key}`, 
						desc: `FK for ${rel.name} (${target.name}.${tf.key})`, 
						category: `Relation: ${rel.name}` 
					});
				}
			}
		}

		items.push({ name: 'None', desc: 'Clear mapping', category: 'Action' });
		return items;
	});

	const activeMappingLabel = $derived.by(() => {
		if (field.sourceMapping) return `source.${field.sourceMapping}`;
		if (field.relationMapping) return `${field.relationMapping.relationName}.${field.relationMapping.targetFieldKey}`;
		return null;
	});

	// ── Auto-focus on mount ────────────────────────────────────────────────
	$effect(() => {
		if (autofocus && keyInputEl) {
			keyInputEl.focus();
		}
	});

	// ── Handlers ───────────────────────────────────────────────────────────

	function openMappingDropdown(el?: HTMLElement) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el ?? keyInputEl;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		phase = 'mapping';
		dropdownOpen = 'mapping';
	}

	function handleMappingSelect(name: string) {
		dropdownOpen = null;
		const activeSchema = store.activeSchema;
		if (!activeSchema) return;

		if (name === 'None') {
			store.updateField(activeSchema.id, field.id, { sourceMapping: undefined, relationMapping: undefined });
		} else if (name.startsWith('src:')) {
			const key = name.slice(4);
			store.updateField(activeSchema.id, field.id, { sourceMapping: key, relationMapping: undefined });
		} else if (name.startsWith('rel:')) {
			const parts = name.split(':');
			const relationName = parts[1];
			const targetFieldKey = parts[2];
			store.updateField(activeSchema.id, field.id, { 
				sourceMapping: undefined, 
				relationMapping: { relationName, targetFieldKey } 
			});
		}
		phase = 'modifiers';
		tick().then(() => modAreaEl?.focus());
	}

	function handleKeyInputKeydown(e: KeyboardEvent) {
		if (e.key === ':') {
			e.preventDefault();
			openTypeDropdown(keyInputEl ?? undefined);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) onexitnesting(field.id);
			else onnextsibling(field.id);
		} else if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '') {
			e.preventDefault();
			onremove(field.id);
		} else if (e.key === 'Escape') {
			(e.target as HTMLElement).blur();
		}
	}

	function openTypeDropdown(el?: HTMLElement) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el ?? typeChipEl ?? keyInputEl;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		phase = 'type';
		dropdownOpen = 'type';
	}

	function handleTypeSelect(name: string) {
		const newType = name as ZodFieldType;
		dropdownOpen = null;
		onupdatetype(field.id, newType);
		if (newType === 'enum') {
			phase = 'enumTags';
		} else {
			phase = 'modifiers';
			tick().then(() => {
				const btn = modAreaEl?.querySelector('.dot-btn') as HTMLElement | null;
				(btn || modAreaEl)?.focus();
			});
		}
	}

	function openModifierDropdown(el?: HTMLElement) {
		if (availableMods.length === 0) return;
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el ?? modAreaEl;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		replacingModifierIndex = null;
		phase = 'modifierPicker';
		dropdownOpen = 'modifier';
	}

	function handleModifierSelect(name: string) {
		dropdownOpen = null;
		const activeSchema = store.activeSchema;
		if (!activeSchema) return;

		const spec = availableMods.find((m) => m.name === name);
		if (!spec) return;

		const targetIdx = replacingModifierIndex !== null ? replacingModifierIndex : field.modifiers.length;
		if (replacingModifierIndex !== null) store.removeModifier(activeSchema.id, field.id, replacingModifierIndex);
		
		store.addModifier(activeSchema.id, field.id, { name, value: spec.hasValue ? spec.defaultValue : undefined });
		
		if (spec.hasValue) {
			editingModifierIndex = targetIdx;
			phase = 'modifierArg';
		} else {
			editingModifierIndex = null;
			phase = 'modifiers';
			tick().then(() => modAreaEl?.focus());
		}
		replacingModifierIndex = null;
	}

	function handleModAreaKeydown(e: KeyboardEvent) {
		const activeSchema = store.activeSchema;
		if (!activeSchema) return;

		if (e.key === '.') {
			e.preventDefault();
			openModifierDropdown(modAreaEl ?? undefined);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			if (field.modifiers.length > 0) store.removeModifier(activeSchema.id, field.id, field.modifiers.length - 1);
			else if (isEnum) phase = 'enumTags';
			else openTypeDropdown();
		} else if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			if (e.shiftKey) onexitnesting(field.id);
			else onnextsibling(field.id);
		}
	}

	function closeDropdown() {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		dropdownOpen = null;
		replacingModifierIndex = null;
		if (['type', 'modifierPicker', 'mapping'].includes(phase)) phase = 'modifiers';
		tick().then(() => modAreaEl?.focus());
	}

	const indentPx = $derived(12 + field.indent * 20);
</script>

<div
	class="editor-line"
	class:is-active={isActive}
	class:is-group={isGroup}
	role="button"
	tabindex="-1"
	aria-label="Edit field {field.key}"
	style="--indent: {indentPx}px"
	data-field-id={field.id}
	data-testid="editor-line"
	onclick={(e) => {
		const t = e.target as HTMLElement;
		if (!t.closest('.key-input, .type-chip, .mod-pill, .enum-tags, .dot-btn, .remove-btn, .inline-dropdown, .mapping-area, .mapping-btn')) {
			keyInputEl?.focus();
		}
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter') keyInputEl?.focus();
	}}
>
	<span class="indent-gutter" aria-hidden="true"></span>

	<div class="key-cell">
		<input
			bind:this={keyInputEl}
			class="key-input t-code"
			style="width: {Math.max(field.key.length, 4)}ch"
			value={field.key}
			placeholder="name"
			oninput={(e) => store.activeSchema && store.updateField(store.activeSchema.id, field.id, { key: (e.target as HTMLInputElement).value })}
			onkeydown={handleKeyInputKeydown}
			onfocus={() => { phase = 'name'; onfocus?.(field.id); }}
			aria-label="Field name"
		/>

		{#if mappingMenuItems.length > 1 || heuristicMatch}
			<div class="mapping-anchor-inline">
				<button
					type="button"
					class="mapping-btn"
					class:is-mapped={!!activeMappingLabel}
					class:is-magic={!!heuristicMatch && !activeMappingLabel}
					title={activeMappingLabel ? `Mapped to ${activeMappingLabel}` : (heuristicMatch ? `Heuristic match: ${heuristicMatch.name}` : 'Map field...')}
					onclick={(e) => openMappingDropdown(e.currentTarget as HTMLElement)}
				>
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
					{#if activeMappingLabel}
						<span class="mapped-label t-code-tight">{activeMappingLabel}</span>
					{:else if heuristicMatch}
						<span class="mapped-label t-code-tight magic">*{heuristicMatch.name}</span>
					{/if}
				</button>

				{#if dropdownOpen === 'mapping'}
					<InlineDropdown
						items={mappingMenuItems}
						value={activeMappingLabel ?? undefined}
						scope="mapping"
						onselect={handleMappingSelect}
						onclose={closeDropdown}
					/>
				{/if}
			</div>
		{/if}
	</div>

	<span class="sep t-code" aria-hidden="true">:</span>

	<span class="type-area" style="position: relative">
		<span
			bind:this={typeChipEl}
			class="type-chip t-code-sm"
			class:has-type={!!field.type}
			data-type={field.type}
			role="button"
			tabindex="0"
			onclick={(e) => openTypeDropdown(e.currentTarget as HTMLElement)}
			onkeydown={(e) => e.key === 'Enter' && openTypeDropdown(e.currentTarget as HTMLElement)}
		>
			{#if field.type}
				{FIELD_TYPES[field.type]?.label ?? field.type}
			{:else}
				<span class="type-placeholder">type?</span>
			{/if}
		</span>

		{#if dropdownOpen === 'type'}
			<InlineDropdown
				items={typeMenuItems}
				value={field.type}
				scope="type"
				onselect={handleTypeSelect}
				onclose={closeDropdown}
			/>
		{/if}
	</span>

	{#if isEnum}
		<EnumTagInput
			values={field.enumValues ?? []}
			onchange={(vals) => store.activeSchema && store.updateField(store.activeSchema.id, field.id, { enumValues: vals })}
			ondone={() => { phase = 'modifiers'; tick().then(() => modAreaEl?.focus()); }}
		/>
	{/if}

	<div class="mods-area">
		{#each field.modifiers as mod, i}
			<span class="mod-pill t-code-sm">
				<button
					type="button"
					class="mod-name-btn"
					onclick={(e) => { replacingModifierIndex = i; openModifierDropdown(e.currentTarget as HTMLElement); }}
					style="position: relative"
				>
					{mod.name.replace(/\(\)$/, '')}
					{#if dropdownOpen === 'modifier' && replacingModifierIndex === i}
						<InlineDropdown
							items={modifierMenuItems}
							value={mod.name}
							scope="modifier"
							onselect={handleModifierSelect}
							onclose={closeDropdown}
						/>
					{/if}
				</button>

				{#if mod.value !== undefined}
					{#if editingModifierIndex === i}
						<InlineArgInput
							value={mod.value}
							oncommit={(v, isNext) => {
								editingModifierIndex = null;
								phase = 'modifiers';
								store.activeSchema && store.updateModifierValue(store.activeSchema.id, field.id, i, v);
								tick().then(() => { modAreaEl?.focus(); if (isNext) openModifierDropdown(); });
							}}
							oncancel={() => { editingModifierIndex = null; phase = 'modifiers'; store.activeSchema && store.removeModifier(store.activeSchema.id, field.id, i); tick().then(() => modAreaEl?.focus()); }}
						/>
					{:else}
						<button type="button" class="mod-val t-code-sm" onclick={() => { editingModifierIndex = i; phase = 'modifierArg'; }}>
							<span class="punct">(</span><span class="val">{mod.value}</span><span class="punct">)</span>
						</button>
					{/if}
				{:else if mod.name.endsWith('()')}
					<span class="mod-parens t-code-sm"><span class="punct">()</span></span>
				{/if}

				<button class="mod-x" type="button" onclick={(e) => { e.stopPropagation(); store.activeSchema && store.removeModifier(store.activeSchema.id, field.id, i); }}>×</button>
			</span>
		{/each}

		<div
			bind:this={modAreaEl}
			class="mod-add-area"
			role="button"
			tabindex={phase === 'modifiers' || field.type ? 0 : -1}
			onkeydown={handleModAreaKeydown}
			onfocus={() => { phase = 'modifiers'; onfocus?.(field.id); }}
		>
			{#if availableMods.length > 0}
				<button class="dot-btn t-code-sm" type="button" onclick={(e) => { e.stopPropagation(); openModifierDropdown(e.currentTarget as HTMLElement); }}>.</button>
			{/if}
			{#if dropdownOpen === 'modifier' && replacingModifierIndex === null}
				<InlineDropdown items={modifierMenuItems} scope="modifier" onselect={handleModifierSelect} onclose={closeDropdown} />
			{/if}
		</div>
	</div>
	
	<button class="remove-btn" type="button" onclick={(e) => { e.stopPropagation(); onremove(field.id); }}>×</button>
</div>

<style>
	.editor-line {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 28px;
		padding: var(--space-1) var(--space-4) var(--space-1) var(--indent, var(--space-4));
		border-bottom: 1px solid var(--bg-2);
		position: relative;
		cursor: text;
	}

	.editor-line:hover { background: var(--bg-2); }
	.editor-line.is-active { background: var(--bg-1); box-shadow: inset 2px 0 0 var(--accent); }
	.editor-line.is-group { border-bottom-color: var(--line-strong); }

	.key-cell { display: flex; align-items: center; min-width: 140px; }
	.key-input { background: transparent; border: none; color: var(--syn-key); padding: 2px 4px; border-radius: var(--radius-sm); font: inherit; flex-shrink: 1; min-width: 0; }
	.key-input:focus { outline: none; background: var(--bg-3); box-shadow: 0 0 0 1px var(--accent-edge); }

	.mapping-anchor-inline { display: flex; align-items: center; }
	.mapping-btn { display: flex; align-items: center; gap: 4px; padding: 1px 4px; border-radius: var(--radius-sm); color: var(--ink-3); background: transparent; border: 1px solid transparent; cursor: pointer; opacity: 0.4; }
	.mapping-btn:hover { opacity: 1; background: var(--bg-1); border-color: var(--line); }
	.mapping-btn.is-magic { opacity: 0.6; color: var(--ink-3); background: var(--bg-1); border-color: var(--line-strong); }
	.mapping-btn.is-mapped:hover, .mapping-btn.is-magic:hover { opacity: 1; background: var(--accent-soft); }
	.mapped-label { font-size: 10px; font-weight: 600; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.mapped-label.magic { color: var(--ink-3); font-style: italic; font-weight: 400; }

	.type-chip { display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: var(--radius-sm); border: 1px solid var(--line-strong); background: var(--bg-3); color: var(--syn-type); cursor: pointer; font-size: 12px; }
	.type-chip:hover { border-color: var(--accent-edge); background: var(--accent-soft); color: var(--accent-bright); }
	.type-placeholder { color: var(--ink-3); font-style: italic; }

	.sep { color: var(--ink-3); }

	.mods-area { display: inline-flex; align-items: center; gap: var(--space-1); }
	.mod-pill { display: inline-flex; align-items: center; gap: 1px; padding: 0 4px; height: 20px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--bg-2); color: var(--ink-1); }
	.mod-name-btn { background: transparent; border: none; padding: 0; color: var(--syn-fn); font: inherit; cursor: pointer; font-weight: 500; }
	.mod-name-btn:focus { outline: none; color: var(--accent-bright); }
	.mod-val { background: transparent; border: none; padding: 0; color: inherit; font: inherit; cursor: pointer; }
	.mod-val .punct { color: var(--ink-3); opacity: 0.7; }
	.mod-val .val { color: var(--syn-number); }
	.mod-parens .punct { color: var(--ink-3); opacity: 0.7; }
	.mod-x { background: transparent; border: none; color: var(--ink-3); font-size: 11px; cursor: pointer; padding: 0; opacity: 0; margin-left: 2px; }
	.mod-pill:hover .mod-x { opacity: 1; }

	.mod-add-area { display: inline-flex; align-items: center; outline: none; }
	.dot-btn { background: transparent; border: none; color: var(--ink-3); cursor: pointer; padding: 0 4px; font-weight: 800; font-size: 14px; }
	.dot-btn:hover { color: var(--accent-bright); }

	.remove-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--ink-3); font-size: 16px; cursor: pointer; opacity: 0; }
	.editor-line:hover .remove-btn { opacity: 1; }
	.remove-btn:hover { color: var(--warn); }
</style>
