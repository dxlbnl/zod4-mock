<script lang="ts">
	import Input from '../Primitives/Input.svelte';

	interface MenuItem {
		name: string;
		desc: string;
		category: string;
	}

	interface Props {
		scope: string;
		items: MenuItem[];
		value?: string;
		onselect?: (name: string, isKeyboard?: boolean) => void;
		onclose?: () => void;
		caretOffset?: number;
		trigger?: HTMLElement;
	}

	let { scope, items, value, onselect, onclose, caretOffset = 14, trigger }: Props = $props();
	let filter = $state('');
	
	$effect.pre(() => {
		// Reset filter when scope changes (e.g. from type to modifier)
		void scope;
		filter = '';
	});
	
	let searchInput = $state<HTMLInputElement>();

	let filteredItems = $derived(
		items.filter(
			(item) =>
				item.name.toLowerCase().includes(filter.toLowerCase()) ||
				item.desc.toLowerCase().includes(filter.toLowerCase())
		)
	);

	let activeIndex = $state(0);

	import { tick } from 'svelte';
	$effect(() => {
		// Update active index when filter, items, scope, or value changes
		if (filter === '') {
			const target = (value || scope || '').toLowerCase();
			const idx = items.findIndex((item) => item.name.toLowerCase() === target);
			activeIndex = idx !== -1 ? idx : 0;
		} else {
			activeIndex = 0;
		}
	});

	$effect(() => {
		// Ensure focus when menu opens or scope changes
		void scope;
		tick().then(() => {
			searchInput?.focus();
		});
	});

	function onkeydown(e: KeyboardEvent) {
		if (filteredItems.length === 0) {
			if (e.key === 'Escape' || e.key === 'Tab') {
				e.preventDefault();
				onclose?.();
			}
			return;
		}

		if (e.key === 'Tab') {
			// Committing current selection on Tab
			e.preventDefault();
			if (filteredItems[activeIndex]) {
				onselect?.(filteredItems[activeIndex].name, true);
			} else {
				onclose?.();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % filteredItems.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + filteredItems.length) % filteredItems.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (filteredItems[activeIndex]) {
				onselect?.(filteredItems[activeIndex].name, true);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onclose?.();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="float-menu" style="--caret: {caretOffset}px" {onkeydown} role="menu" tabindex="-1">
	<div class="search">
		<Input 
			bind:this={searchInput} 
			class="search-input" 
			placeholder="filter…" 
			bind:value={filter} 
		/>
		<span class="scope t-code-tight">{scope}</span>
	</div>

	{#each filteredItems as item, i}
		{#if i === 0 || item.category !== filteredItems[i - 1].category}
			<div class="grp t-eyebrow">{item.category}</div>
		{/if}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="item t-code-sm"
			role="menuitem"
			tabindex="-1"
			class:active={activeIndex === i}
			onclick={() => onselect?.(item.name)}
		>
			<span class="name">{item.name}</span>
			<span class="desc t-code-tight">{item.desc}</span>
		</div>
	{/each}

	{#if filteredItems.length === 0}
		<div class="empty">No matches found</div>
	{/if}

	<div class="foot t-code-tight">
		<span>↑↓ nav</span>
		<span>⏎ add</span>
		<span>esc close</span>
	</div>
</div>

<style>
	.float-menu {
		position: relative;
		width: 256px;
		background: var(--bg-1);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-pop);
		display: flex;
		flex-direction: column;
		overflow: visible; /* Allow caret to show outside */
		z-index: 1000;
	}

	/* Caret implementation using pseudo-element */
	.float-menu::before {
		content: '';
		position: absolute;
		top: -6px;
		left: var(--caret);
		width: 10px;
		height: 10px;
		background: var(--bg-1);
		border-left: 1px solid var(--line-strong);
		border-top: 1px solid var(--line-strong);
		transform: rotate(45deg);
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-bottom: 1px solid var(--line);
		background: var(--bg-2);
	}
	.search :global(.search-input) {
		flex: 1;
		background: transparent;
		border: 0;
		color: var(--ink-0);
		outline: 0;
		padding: 0;
		height: auto;
		box-shadow: none;
	}
	.search :global(.search-input:focus:not(:disabled)) {
		box-shadow: none;
		border: 0;
	}
	.search .scope {
		color: var(--ink-2);
		padding: 1px var(--space-1);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
	}

	.grp {
		padding: 10px var(--space-4) var(--space-1);
		color: var(--ink-2);
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-4);
		cursor: pointer;
	}
	.item:hover,
	.item.active {
		background: var(--accent-soft);
	}
	.item .name {
		color: var(--ink-0);
	}
	.item .desc {
		color: var(--ink-2);
	}

	.empty {
		padding: 20px;
		text-align: center;
		color: var(--ink-2);
		font-size: 11px;
	}

	.foot {
		margin-top: auto;
		display: flex;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg-2);
		border-top: 1px solid var(--line);
		color: var(--ink-3);
	}
</style>
