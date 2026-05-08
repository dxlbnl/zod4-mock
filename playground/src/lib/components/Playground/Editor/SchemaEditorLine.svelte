<script lang="ts">
	/**
	 * SchemaEditorLine.svelte
	 * Renders a single field as an inline "expression" line:
	 *
	 *   [indent] [key] [:] [TypeChip] [<ElementType>] [enum tags] [mod pills…] [. btn] [×]
	 *
	 * All structural keys drive the phase machine:
	 *   ':'  → open type dropdown
	 *   '.'  → open modifier dropdown
	 *   'Enter' / ','  → commit field, request next sibling
	 *   'Shift+Enter'  → exit nesting
	 *   'Backspace'    → contextual delete (see interaction flows)
	 */

	import InlineDropdown from './InlineDropdown.svelte';
	import InlineArgInput from './InlineArgInput.svelte';
	import EnumTagInput from './EnumTagInput.svelte';
	import type { EditorPhase } from './schema-editor.types';
	import type { FieldDef, ModifierDef } from '$lib/state.svelte';
	import {
		FIELD_TYPES,
		SELECTABLE_FIELD_TYPES,
		getModifiers,
		type ZodFieldType
	} from '$lib/field-types';
	import { tick } from 'svelte';

	interface Props {
		field: FieldDef;
		/** Whether this line currently has editor focus */
		isActive?: boolean;
		/** Whether the key input should auto-focus on mount */
		autofocus?: boolean;

		// ── Callbacks ──────────────────────────────────────────────────────
		onupdatekey: (id: string, key: string) => void;
		onupdatetype: (id: string, type: ZodFieldType) => void;
		onupdateelementtype?: (id: string, type: ZodFieldType) => void;
		onaddmodifier: (id: string, mod: ModifierDef) => void;
		onupdatemodifier: (id: string, index: number, value: string | number | boolean) => void;
		onremovemodifier: (id: string, index: number) => void;
		onupdateenumvalues: (id: string, values: string[]) => void;
		onremove: (id: string) => void;
		/** User pressed Enter/comma — add next sibling */
		onnextsibling: (id: string) => void;
		/** User pressed Shift+Enter — exit nesting */
		onexitnesting: (id: string) => void;
		/** Notify parent that this line became focused */
		onfocus?: (id: string) => void;

		/** Binding related (Story 3) */
		availableSourceKeys?: string[];
		mappedSourceKey?: string | null;
		onsetmapping?: (id: string, schemaFieldKey: string, subjectFieldKey: string) => void;
		onremovemapping?: (id: string, schemaFieldKey: string) => void;
	}

	let {
		field,
		isActive = false,
		autofocus = false,
		onupdatekey,
		onupdatetype,
		onupdateelementtype,
		onaddmodifier,
		onupdatemodifier,
		onremovemodifier,
		onupdateenumvalues,
		onremove,
		onnextsibling,
		onexitnesting,
		onfocus,
		availableSourceKeys = [],
		mappedSourceKey = null,
		onsetmapping,
		onremovemapping
	}: Props = $props();

	// ── Phase / dropdown state ─────────────────────────────────────────────
	let phase = $state<EditorPhase | 'mapping'>('name');
	let dropdownOpen = $state<'type' | 'elementType' | 'modifier' | 'mapping' | null>(null);
	/** Index of the modifier whose arg is currently being edited */
	let editingModifierIndex = $state<number | null>(null);
	/** Index of the modifier whose name is being replaced via dropdown */
	let replacingModifierIndex = $state<number | null>(null);

	let activeAnchorEl = $state<HTMLElement | null>(null);

	// ── DOM refs ───────────────────────────────────────────────────────────
	let keyInputEl = $state<HTMLInputElement | null>(null);
	let typeChipEl = $state<HTMLElement | null>(null);
	let elementTypeChipEl = $state<HTMLElement | null>(null);
	let modAreaEl = $state<HTMLElement | null>(null);
	let lineEl = $state<HTMLElement | null>(null);

	// ── Derived ───────────────────────────────────────────────────────────
	const spec = $derived(FIELD_TYPES[field.type] ?? null);
	const isGroup = $derived(field.type === 'object' || field.type === 'array');
	const isArray = $derived(field.type === 'array');
	const isEnum = $derived(field.type === 'enum');
	const availableMods = $derived(getModifiers(field.type));

	const typeMenuItems = SELECTABLE_FIELD_TYPES.map((t) => ({
		name: t,
		desc: FIELD_TYPES[t].zodExpr,
		category: 'Zod Types'
	}));

	/** Element-type menu — same set but excludes 'array' for simplicity */
	const elementTypeMenuItems = SELECTABLE_FIELD_TYPES.filter((t) => t !== 'array').map((t) => ({
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

	const mappingMenuItems = $derived([
		...availableSourceKeys.map((k) => ({
			name: k,
			desc: `Map to ${k}`,
			category: 'Subject Fields'
		})),
		{ name: 'None', desc: 'Clear mapping', category: 'Action' }
	]);

	// ── Mapping ────────────────────────────────────────────────────────────
	function openMappingDropdown(el?: HTMLElement) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el ?? keyInputEl;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		phase = 'mapping';
		dropdownOpen = 'mapping';
	}

	function handleMappingSelect(subjectFieldKey: string) {
		dropdownOpen = null;
		if (subjectFieldKey === 'None') {
			onremovemapping?.(field.id, field.key);
		} else {
			onsetmapping?.(field.id, field.key, subjectFieldKey);
		}
		phase = 'modifiers';
		tick().then(() => modAreaEl?.focus());
	}

	function handleRemoveMapping() {
		onremovemapping?.(field.id, field.key);
		dropdownOpen = null;
	}

	// ── Auto-focus on mount ────────────────────────────────────────────────
	$effect(() => {
		if (autofocus && keyInputEl) {
			keyInputEl.focus();
		}
	});

	// ── Name input key handlers ────────────────────────────────────────────
	function handleKeyInputKeydown(e: KeyboardEvent) {
		if (e.key === ':') {
			e.preventDefault();
			openTypeDropdown(keyInputEl ?? undefined);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) {
				onexitnesting(field.id);
			} else {
				onnextsibling(field.id);
			}
		} else if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '') {
			e.preventDefault();
			onremove(field.id);
		} else if (e.key === 'Escape') {
			(e.target as HTMLElement).blur();
		}
	}

	// ── Type selection ─────────────────────────────────────────────────────
	function openTypeDropdown(el?: HTMLElement) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el ?? typeChipEl ?? keyInputEl;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		phase = 'type';
		dropdownOpen = 'type';
	}

	function handleTypeSelect(name: string) {
		const newType = name as ZodFieldType;
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		dropdownOpen = null;
		onupdatetype(field.id, newType);

		if (newType === 'array') {
			// Open element type picker next
			tick().then(() => {
				activeAnchorEl = elementTypeChipEl;
				if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
				phase = 'elementType';
				dropdownOpen = 'elementType';
			});
		} else if (newType === 'enum') {
			phase = 'enumTags';
			dropdownOpen = null;
		} else {
			phase = 'modifiers';
			tick().then(() => modAreaEl?.focus());
		}
	}

	function handleElementTypeSelect(name: string) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		dropdownOpen = null;
		phase = 'modifiers';
		onupdateelementtype?.(field.id, name as ZodFieldType);
		tick().then(() => modAreaEl?.focus());
	}

	// ── Modifier flows ─────────────────────────────────────────────────────
	function openModifierDropdown(el?: HTMLElement) {
		if (availableMods.length === 0) return;
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el ?? modAreaEl;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		replacingModifierIndex = null;
		phase = 'modifierPicker';
		dropdownOpen = 'modifier';
	}

	function openModifierReplace(index: number, el: HTMLElement) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		activeAnchorEl = el;
		if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
		replacingModifierIndex = index;
		phase = 'modifierPicker';
		dropdownOpen = 'modifier';
	}

	function handleModifierSelect(name: string) {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		dropdownOpen = null;
		const spec = availableMods.find((m) => m.name === name);
		if (!spec) return;

		if (replacingModifierIndex !== null) {
			// Replace existing modifier
			const targetIdx = replacingModifierIndex;
			onremovemodifier(field.id, replacingModifierIndex);
			const defaultVal1 = spec.hasValue
				? (typeof spec.defaultValue === 'boolean' ? String(spec.defaultValue) : spec.defaultValue)
				: undefined;
			onaddmodifier(field.id, { name, value: defaultVal1 });
			replacingModifierIndex = null;
			if (spec.hasValue) {
				editingModifierIndex = targetIdx;
				phase = 'modifierArg';
			} else {
				editingModifierIndex = null;
				phase = 'modifiers';
				tick().then(() => modAreaEl?.focus());
			}
		} else {
			// Add new modifier
			const newIdx = field.modifiers.length;
			const defaultVal2 = spec.hasValue
				? (typeof spec.defaultValue === 'boolean' ? String(spec.defaultValue) : spec.defaultValue)
				: undefined;
			onaddmodifier(field.id, { name, value: defaultVal2 });
			if (spec.hasValue) {
				editingModifierIndex = newIdx;
				phase = 'modifierArg';
			} else {
				editingModifierIndex = null;
				phase = 'modifiers';
				tick().then(() => modAreaEl?.focus());
			}
		}
	}

	function handleModifierArgCommit(index: number, value: string, isNext = false) {
		editingModifierIndex = null;
		phase = 'modifiers';
		onupdatemodifier(field.id, index, value);
		tick().then(() => {
			modAreaEl?.focus();
			if (isNext) {
				openModifierDropdown();
			}
		});
	}

	function handleModifierArgCancel(index: number) {
		editingModifierIndex = null;
		phase = 'modifiers';
		onremovemodifier(field.id, index);
		tick().then(() => modAreaEl?.focus());
	}

	// ── Modifier area keyboard handling ────────────────────────────────────
	function handleModAreaKeydown(e: KeyboardEvent) {
		if (e.key === '.') {
			e.preventDefault();
			openModifierDropdown(modAreaEl ?? undefined);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			if (field.modifiers.length > 0) {
				onremovemodifier(field.id, field.modifiers.length - 1);
			} else if (isEnum) {
				phase = 'enumTags';
			} else if (field.type) {
				openTypeDropdown();
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) {
				onexitnesting(field.id);
			} else {
				onnextsibling(field.id);
			}
		} else if (e.key === ',') {
			e.preventDefault();
			onnextsibling(field.id);
		}
	}

	// ── Type chip click ────────────────────────────────────────────────────
	function handleTypeChipClick(e: MouseEvent) {
		openTypeDropdown(e.currentTarget as HTMLElement);
	}

	// ── Close dropdown ─────────────────────────────────────────────────────
	function closeDropdown() {
		if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
		dropdownOpen = null;
		replacingModifierIndex = null;
		if (phase === 'type' || phase === 'elementType' || phase === 'modifierPicker' || phase === 'mapping') {
			phase = 'modifiers';
		}
		tick().then(() => modAreaEl?.focus());
	}

	// ── Click on the line (outside interactive elements) ──────────────────
	function handleLineClick(e: MouseEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('.key-input, .type-chip, .mod-pill, .enum-tags, .dot-btn, .remove-btn, .inline-dropdown, .mapping-area')) return;
		keyInputEl?.focus();
	}

	const indentPx = $derived(12 + field.indent * 20);

	// ── FIELD_TYPES elementType (stored in field.children[0]?.type for arrays) ──
	// We store the array element type as a special field on the FieldDef.
	// For now, we read it from a custom prop and pass it through.
	// The parent SchemaEditor will store elementType in the field via a metadata approach.
	// Simple approach: store it as the first child's type IF it's an array.
	const elementType = $derived<ZodFieldType | null>(
		isArray && field.children?.[0]?.type ? field.children[0].type : null
	);
	const elementTypeSpec = $derived(elementType ? FIELD_TYPES[elementType] : null);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={lineEl}
	class="editor-line"
	class:is-active={isActive}
	class:is-group={isGroup}
	style="--indent: {indentPx}px"
	data-field-id={field.id}
	data-testid="editor-line"
	onclick={handleLineClick}
>
	<!-- Indent gutter -->
	<span class="indent-gutter" aria-hidden="true"></span>

	<!-- Key (name) cell -->
	<div class="key-cell">
		<input
			bind:this={keyInputEl}
			class="key-input t-code"
			style="width: {Math.max(field.key.length, 4)}ch"
			value={field.key}
			placeholder="name"
			oninput={(e) => onupdatekey(field.id, (e.target as HTMLInputElement).value)}
			onkeydown={handleKeyInputKeydown}
			onfocus={() => { phase = 'name'; onfocus?.(field.id); }}
			data-testid="key-input"
		/>

		<!-- Mapping (Story 3) - Inline with text -->
		{#if availableSourceKeys.length > 0}
			<div class="mapping-anchor-inline">
				<button
					type="button"
					class="mapping-btn"
					class:is-mapped={!!mappedSourceKey}
					title={mappedSourceKey ? `Mapped to ${mappedSourceKey}` : 'Map to subject field'}
					onclick={(e) => openMappingDropdown(e.currentTarget as HTMLElement)}
				>
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
					{#if mappedSourceKey}
						<span class="mapped-label t-code-tight">{mappedSourceKey}</span>
					{/if}
				</button>

				{#if dropdownOpen === 'mapping'}
					<InlineDropdown
						items={mappingMenuItems}
						value={mappedSourceKey ?? undefined}
						scope="mapping"
						onselect={handleMappingSelect}
						onclose={closeDropdown}
					/>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Separator -->
	<span class="sep t-code" aria-hidden="true">:</span>

	<!-- Type chip area (relative so dropdown can anchor) -->
	<span class="type-area" style="position: relative">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<span
			bind:this={typeChipEl}
			class="type-chip t-code-sm"
			class:has-type={!!field.type}
			data-type={field.type}
			role="button"
			aria-label="Change type"
			onclick={handleTypeChipClick}
		>
			{#if field.type}
				{FIELD_TYPES[field.type]?.label ?? field.type}
			{:else}
				<span class="type-placeholder">type?</span>
			{/if}
		</span>

		{#if dropdownOpen === 'type'}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<InlineDropdown
				items={typeMenuItems}
				value={field.type}
				scope="type"
				onselect={handleTypeSelect}
				onclose={closeDropdown}
			/>
		{/if}
	</span>

	<!-- Array element type (inline secondary type chip) -->
	{#if isArray}
		<span class="array-element-area" style="position: relative">
			<span class="array-chevron t-code" aria-hidden="true">&lt;</span>
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<span
				bind:this={elementTypeChipEl}
				class="type-chip element-chip t-code-sm"
				class:has-type={!!elementType}
				data-type={elementType ?? ''}
				role="button"
				aria-label="Change element type"
				onclick={(e) => { 
					if (activeAnchorEl) activeAnchorEl.style.removeProperty('anchor-name');
					activeAnchorEl = e.currentTarget as HTMLElement;
					if (activeAnchorEl) activeAnchorEl.style.setProperty('anchor-name', '--editor-anchor');
					phase = 'elementType'; 
					dropdownOpen = 'elementType'; 
				}}
			>
				{elementTypeSpec?.label ?? 'element?'}
			</span>
			<span class="array-chevron t-code" aria-hidden="true">&gt;</span>

			{#if dropdownOpen === 'elementType'}
				<InlineDropdown
					items={elementTypeMenuItems}
					value={elementType ?? ''}
					scope="element"
					onselect={handleElementTypeSelect}
					onclose={closeDropdown}
				/>
			{/if}
		</span>
	{/if}

	<!-- Enum tags -->
	{#if isEnum}
		<EnumTagInput
			values={field.enumValues ?? []}
			onchange={(vals) => onupdateenumvalues(field.id, vals)}
			ondone={() => { phase = 'modifiers'; tick().then(() => modAreaEl?.focus()); }}
		/>
	{/if}

	<!-- Modifier pills -->
	<span class="mods-area" bind:this={modAreaEl}>
		{#each field.modifiers as mod, i}
			<span class="mod-pill t-code-sm" data-category={availableMods.find(m => m.name === mod.name)?.category}>
				<!-- Modifier name — click to replace -->
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<span
					class="mod-name"
					role="button"
					aria-label="Replace modifier"
					onclick={(e) => openModifierReplace(i, e.currentTarget as HTMLElement)}
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
				</span>

				<!-- Arg (value) -->
				{#if mod.value !== undefined}
					{#if editingModifierIndex === i}
						<InlineArgInput
							value={mod.value}
							oncommit={(v, isNext) => handleModifierArgCommit(i, v, isNext)}
							oncancel={() => handleModifierArgCancel(i)}
						/>
					{:else}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="mod-val t-code-sm"
							onclick={() => { editingModifierIndex = i; phase = 'modifierArg'; }}
						>
							<span class="punct">(</span><span class="val">{mod.value}</span><span class="punct">)</span>
						</span>
					{/if}
				{:else if mod.name.endsWith('()')}
					<span class="mod-parens t-code-sm"><span class="punct">()</span></span>
				{/if}

				<!-- Remove modifier -->
				<button
					class="mod-x"
					type="button"
					aria-label="Remove modifier {mod.name}"
					onclick={(e) => { e.stopPropagation(); onremovemodifier(field.id, i); }}
				>×</button>
			</span>
		{/each}

		<!-- Modifier add area — receives focus for keyboard navigation -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<span
			class="mod-add-area"
			tabindex={phase === 'modifiers' || field.type ? 0 : -1}
			role="presentation"
			onkeydown={handleModAreaKeydown}
			onfocus={() => { phase = 'modifiers'; onfocus?.(field.id); }}
		>
			{#if availableMods.length > 0}
				<button
					class="dot-btn t-code-sm"
					type="button"
					aria-label="Add modifier"
					onclick={(e) => { 
						e.stopPropagation(); 
						activeAnchorEl = e.currentTarget as HTMLElement;
						openModifierDropdown(); 
					}}
				>.</button>
			{/if}

			{#if dropdownOpen === 'modifier' && replacingModifierIndex === null}
				<InlineDropdown
					items={modifierMenuItems}
					scope="modifier"
					onselect={handleModifierSelect}
					onclose={closeDropdown}
				/>
			{/if}
		</span>
	</span>
	
	<!-- Remove button -->
	<button
		class="remove-btn"
		type="button"
		aria-label="Remove field {field.key}"
		onclick={(e) => { e.stopPropagation(); onremove(field.id); }}
	>×</button>
</div>

<style>
	.editor-line {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: var(--space-1);
		min-height: var(--h-row);
		padding: var(--space-1) var(--space-4) var(--space-1) var(--indent, var(--space-4));
		border-bottom: 1px solid var(--bg-2);
		position: relative;
		cursor: text;
		transition: background var(--ease-quick);
	}

	.editor-line:hover {
		background: var(--bg-2);
	}

	.editor-line.is-active {
		background: var(--bg-1);
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.editor-line.is-group {
		border-bottom-color: var(--line-strong);
	}

	/* Indent gutter */
	.indent-gutter {
		display: none; /* purely consumed by --indent CSS var */
	}

	/* Key cell and input */
	.key-cell {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		min-width: 140px;
		flex-shrink: 0;
	}

	.key-input {
		background: transparent;
		border: none;
		color: var(--syn-key);
		padding: 2px 2px 2px 4px;
		border-radius: var(--radius-sm);
		font: inherit;
		flex-shrink: 1;
		min-width: 0;
	}

	.mapping-anchor-inline {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.key-input:focus {
		outline: none;
		background: var(--bg-3);
		box-shadow: 0 0 0 1px var(--accent-edge);
	}

	/* Type chip — Aligned with Builder/TypeChip.svelte */
	.type-chip {
		display: inline-flex;
		align-items: center;
		height: 20px;
		padding: 0 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--line-strong);
		background: var(--bg-3);
		color: var(--syn-type);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--ease-quick);
		user-select: none;
	}

	.type-chip:hover,
	.type-chip.has-type:hover {
		border-color: var(--accent-edge);
		background: var(--accent-soft);
		color: var(--accent-bright);
	}

	.type-chip.has-type {
		background: var(--bg-2);
		border-color: var(--line-strong);
	}

	.type-placeholder {
		color: var(--ink-3);
		font-style: italic;
	}

	/* Mapping (Story 3) */
	.mapping-btn {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 1px 3px;
		border-radius: var(--r-sm);
		color: var(--ink-3);
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all var(--ease-quick);
		opacity: 0.4;
	}

	.mapping-btn:hover {
		opacity: 1;
		background: var(--bg-1);
		color: var(--ink-1);
		border-color: var(--line);
	}

	.mapping-btn.is-mapped {
		opacity: 0.8;
		color: var(--accent);
		background: var(--accent-soft);
	}
	.mapping-btn.is-mapped:hover {
		opacity: 1;
		background: var(--accent-soft-hover, var(--accent-soft));
	}

	.mapped-label {
		font-size: 10px;
		font-weight: 600;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Separator */
	.sep {
		color: var(--ink-3);
	}

	/* Array element type */
	.array-element-area {
		display: inline-flex;
		align-items: center;
		gap: 1px;
	}

	.element-chip {
		height: 18px;
		font-size: 0.85em;
	}

	.array-chevron {
		color: var(--ink-3);
		font-size: 0.85em;
	}

	/* Modifier pills */
	.mods-area {
		display: inline-flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: var(--space-1);
	}

	.mod-pill {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		padding: 0 4px;
		height: var(--h-mod, 20px);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--bg-2);
		color: var(--ink-1);
		user-select: none;
		transition: all var(--ease-quick);
	}

	.mod-pill:hover {
		border-color: var(--accent-edge);
		background: var(--bg-3);
	}

	.mod-name {
		color: var(--syn-fn, var(--ink-1));
		font-weight: 500;
		cursor: pointer;
	}

	.mod-name:hover {
		color: var(--accent);
	}

	.mod-val .punct {
		color: var(--ink-3);
		opacity: 0.7;
	}

	.mod-val .val {
		color: var(--syn-number, hsl(38 90% 65%));
		cursor: pointer;
	}

	.mod-val .val:hover {
		text-decoration: underline;
	}

	.mod-parens .punct {
		color: var(--ink-3);
		opacity: 0.7;
	}

	.mod-x {
		background: transparent;
		border: none;
		color: var(--ink-3);
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		opacity: 0;
		margin-left: 2px;
		display: flex;
		align-items: center;
		border-radius: 50%;
		width: 12px;
		height: 12px;
		justify-content: center;
		transition: all var(--ease-quick);
	}

	.mod-pill:hover .mod-x {
		opacity: 1;
	}

	.mod-x:hover {
		background: var(--ink-3);
		color: var(--bg-1);
	}

	/* Dot button */
	.mod-add-area {
		display: inline-flex;
		align-items: center;
		outline: none;
	}

	.dot-btn {
		background: transparent;
		border: none;
		color: var(--ink-3);
		cursor: pointer;
		padding: 0 2px;
		border-radius: var(--radius-sm);
		font-weight: 700;
		font-size: 1.1em;
		line-height: 1;
		opacity: 0.5;
		transition: all var(--ease-quick);
	}

	.dot-btn:hover,
	.mod-add-area:focus .dot-btn {
		opacity: 1;
		color: var(--accent);
		background: var(--accent-soft);
	}

	/* Remove button */
	.remove-btn {
		position: absolute;
		right: var(--space-2);
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: none;
		color: var(--ink-3);
		cursor: pointer;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: all var(--ease-quick);
	}

	.editor-line:hover .remove-btn,
	.editor-line.is-active .remove-btn {
		opacity: 1;
	}

	.remove-btn:hover {
		background: var(--red-soft, hsl(0 70% 55% / 0.15));
		color: var(--red-bright, hsl(0 70% 65%));
	}
</style>

