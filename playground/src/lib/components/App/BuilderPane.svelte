<script lang="ts">
	import Pane from '../Surfaces/Pane.svelte';
	import FieldList from './FieldList.svelte';
	import FloatingMenu from '../Builder/FloatingMenu.svelte';
	import type { FieldDef, ModifierDef } from '../../state.svelte';
	import { findField } from '../../state.svelte';
	import { getMenuItems, SELECTABLE_FIELD_TYPES } from '../../field-types';
	import { tick } from 'svelte';

	interface Props {
		fields: FieldDef[];
		title: string;
		accentTitle?: string;
		subtitle?: string;
		selectedFieldId?: string | null;

		onselectfield?: (id: string) => void;
		onaddfield?: (parentId?: string) => string | void;
		onremovefield?: (id: string) => void;
		onupdatefield?: (id: string, patch: Partial<FieldDef>) => void;
		onaddmodifier?: (fieldId: string, mod: ModifierDef) => void;
		onremovemodifier?: (fieldId: string, index: number) => void;
	}

	let {
		fields = [],
		title,
		accentTitle,
		subtitle,
		selectedFieldId = null,
		onselectfield,
		onaddfield,
		onremovefield,
		onupdatefield,
		onaddmodifier,
		onremovemodifier
	}: Props = $props();

	let menuOpen = $state(false);
	let menuMode = $state<'modifier' | 'type'>('modifier');
	let menuTargetId = $state<string | null>(null);
	let menuTrigger = $state<HTMLElement | null>(null);
	let lastAddedId = $state<string | null>(null);

	$effect(() => {
		if (menuOpen && menuTrigger) {
			const trigger = menuTrigger;
			trigger.style.setProperty('anchor-name', '--menu-anchor');
			return () => {
				trigger.style.removeProperty('anchor-name');
			};
		}
	});

	$effect(() => {
		if (menuOpen) {
			const handleGlobalKeydown = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					menuOpen = false;
				}
			};
			window.addEventListener('keydown', handleGlobalKeydown);
			return () => window.removeEventListener('keydown', handleGlobalKeydown);
		}
	});

	function handleAddField(parentId?: string) {
		const res = onaddfield?.(parentId);
		if (typeof res === 'string') {
			lastAddedId = res;
		}
	}

	function openMenu(id: string, event: MouseEvent | FocusEvent, mode: 'modifier' | 'type') {
		const target = ((event.currentTarget || event.target) as HTMLElement)?.closest('button, [role="button"]') as HTMLElement;
		if (!target) return;
		
		menuTrigger = target;
		menuMode = mode;
		menuTargetId = id;
		menuOpen = true;
	}

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	async function handleSelect(name: string, isKeyboard?: boolean) {
		if (!menuTargetId) return;

		const field = findField(fields, menuTargetId);
		if (!field) return;

		if (menuMode === 'modifier') {
			onaddmodifier?.(menuTargetId, { name });
			menuOpen = false;
			
			// After adding a modifier, focus the +mod button again so user can add more or tab away
			await tick();
			const modBtn = document.querySelector(`.add-mod[data-field-id="${menuTargetId}"]`) as HTMLElement;
			modBtn?.focus();
		} else {
			const typeChanged = field.type !== name;
			const isContainer = name === 'object' || name === 'array';
			
			onupdatefield?.(menuTargetId, { type: name as any });
			
			if (isKeyboard && !isContainer) {
				// Transition directly to modifier menu
				menuMode = 'modifier';
			} else {
				menuOpen = false;
				if ((isKeyboard || typeChanged) && isContainer && (!field.children || field.children.length === 0)) {
					await tick();
					const newId = onaddfield?.(menuTargetId);
					if (newId) lastAddedId = newId;
				}
			}
		}
	}

	const typeMenuItems = SELECTABLE_FIELD_TYPES.map(t => ({
		name: t,
		desc: `z.${t}()`,
		category: 'Zod Types'
	}));
</script>

<Pane {title} {accentTitle} {subtitle}>
	<div class="builder-content">
		<div class="fields-list">
			<FieldList 
				{fields} 
				{selectedFieldId} 
				lastAddedId={lastAddedId}
				onselectfield={(id) => onselectfield?.(id)}
				onaddfield={handleAddField}
				{onupdatefield}
				onaddmod={(id, e) => openMenu(id, e, 'modifier')}
				onchangetype={(id, e) => openMenu(id, e, 'type')}
				{onremovefield}
				{onremovemodifier}
				onaddprop={() => handleAddField()}
			/>
		</div>

		<div class="actions">
			<button type="button" class="add-btn t-code-sm" onclick={() => handleAddField()}>
				<span class="plus">+</span> add property
			</button>
		</div>
	</div>

	{#if menuOpen}
		{@const field = findField(fields, menuTargetId || '')}
		{#if field}
			<div use:portal>
				<div class="menu-anchor">
					<FloatingMenu
						scope={menuMode === 'modifier' ? field.type : 'base'}
						value={menuMode === 'type' ? field.type : undefined}
						items={menuMode === 'modifier' ? getMenuItems(field.type) : typeMenuItems}
						onselect={handleSelect}
						onclose={() => (menuOpen = false)}
						caretOffset={128}
						trigger={menuTrigger || undefined}
					/>
				</div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="overlay" role="presentation" onclick={() => (menuOpen = false)}></div>
			</div>
		{/if}
	{/if}
</Pane>

<style>
	.builder-content {
		display: flex;
		flex-direction: column;
	}

	.menu-anchor {
		position: absolute;
		z-index: 2000;
		position-anchor: --menu-anchor;
		top: anchor(bottom);
		left: anchor(center);
		transform: translateX(-50%);
		margin-top: 8px;
	}

	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1999;
	}

	.actions {
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

	.add-btn .plus {
		font-size: 1.2em;
		line-height: 0;
		margin-bottom: 2px;
	}
</style>
