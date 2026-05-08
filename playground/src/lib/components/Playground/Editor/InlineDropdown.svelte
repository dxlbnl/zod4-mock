<script lang="ts">
	import { onMount } from 'svelte';

	interface MenuItem {
		name: string;
		desc: string;
		category: string;
	}

	interface Props {
		items: MenuItem[];
		/** Pre-selects the item that matches this value */
		value?: string;
		/** Controls the filter input (bindable from parent if needed) */
		filter?: string;
		/** Label shown in the search box pill, e.g. "type" or "modifier" */
		scope?: string;
		/** The CSS anchor name to attach to (default: --editor-anchor) */
		anchorName?: string;
		onselect?: (name: string) => void;
		onclose?: () => void;
	}

	let {
		items,
		value,
		filter = $bindable(''),
		scope = '',
		anchorName = '--editor-anchor',
		onselect,
		onclose
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);

	$effect.pre(() => {
		// Reset filter when items change (new dropdown context opened)
		void items;
		filter = '';
	});

	let filteredItems = $derived(
		filter.trim() === ''
			? items
			: items.filter(
					(item) =>
						item.name.toLowerCase().includes(filter.toLowerCase()) ||
						item.desc.toLowerCase().includes(filter.toLowerCase())
				)
	);

	let activeIndex = $state(0);

	$effect(() => {
		if (filter === '') {
			const target = (value ?? '').toLowerCase();
			const idx = filteredItems.findIndex((item) => item.name.toLowerCase() === target);
			activeIndex = idx !== -1 ? idx : 0;
		} else {
			activeIndex = 0;
		}
	});

	// Handle clicking outside to close
	$effect(() => {
		const handleClick = (e: MouseEvent) => {
			if (containerEl && !containerEl.contains(e.target as Node)) {
				onclose?.();
			}
		};
		// Use setTimeout to avoid capturing the click that opened the dropdown
		const timer = setTimeout(() => {
			window.addEventListener('click', handleClick);
		}, 0);

		return () => {
			clearTimeout(timer);
			window.removeEventListener('click', handleClick);
		};
	});

	// Focus the input when the dropdown mounts
	$effect(() => {
		inputEl?.focus();
	});

	// Scroll active item into view
	$effect(() => {
		const el = containerEl?.querySelector(`.item[data-idx="${activeIndex}"]`) as HTMLElement | null;
		el?.scrollIntoView({ block: 'nearest' });
	});

	function handleKeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (filteredItems.length === 0) {
			if (e.key === 'Escape') {
				e.preventDefault();
				onclose?.();
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				activeIndex = (activeIndex + 1) % filteredItems.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				activeIndex = (activeIndex - 1 + filteredItems.length) % filteredItems.length;
				break;
			case 'Enter':
			case 'Tab':
				e.preventDefault();
				if (filteredItems[activeIndex]) onselect?.(filteredItems[activeIndex].name);
				break;
			case 'Escape':
				e.preventDefault();
				onclose?.();
				break;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={containerEl}
	class="inline-dropdown"
	style="position-anchor: {anchorName}"
	role="listbox"
	tabindex="-1"
	aria-label={scope ? `Select ${scope}` : 'Select option'}
	onkeydown={handleKeydown}
>
	<div class="search-row">
		<input
			bind:this={inputEl}
			class="filter-input t-code-sm"
			placeholder="filter…"
			bind:value={filter}
			onkeydown={handleKeydown}
		/>
		{#if scope}
			<span class="scope t-code-tight">{scope}</span>
		{/if}
	</div>

	<div class="item-list">
		{#each filteredItems as item, i}
			{#if i === 0 || item.category !== filteredItems[i - 1].category}
				<div class="group-label t-eyebrow">{item.category}</div>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="item t-code-sm"
				class:active={activeIndex === i}
				role="option"
				tabindex="-1"
				aria-selected={activeIndex === i}
				data-idx={i}
				onclick={() => onselect?.(item.name)}
				onmouseenter={() => (activeIndex = i)}
			>
				<span class="item-name">{item.name}</span>
				<span class="item-desc t-code-tight">{item.desc}</span>
			</div>
		{/each}

		{#if filteredItems.length === 0}
			<div class="empty t-code-tight">No matches</div>
		{/if}
	</div>

	<div class="footer t-code-tight">
		<span>↑↓ nav</span>
		<span>⏎ select</span>
		<span>Esc close</span>
	</div>
</div>

<style>
	.inline-dropdown {
		position: fixed;
		top: anchor(bottom);
		left: anchor(left);
		margin-top: 4px;
		z-index: 1000;
		min-width: 240px;
		width: anchor-size(width, 240px);
		background: var(--bg-1);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-pop);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-2);
		border-bottom: 1px solid var(--line);
	}

	.filter-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--ink-0);
		padding: 0;
		min-width: 0;
		font-family: inherit;
		font-size: inherit;
	}

	.scope {
		color: var(--ink-3);
		padding: 1px var(--space-1);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.item-list {
		overflow-y: auto;
		max-height: 220px;
	}

	.group-label {
		padding: 8px var(--space-3) var(--space-1);
		color: var(--ink-3);
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
		gap: var(--space-2);
	}

	.item.active,
	.item:hover {
		background: var(--accent-soft);
	}

	.item-name {
		color: var(--ink-0);
		font-weight: 500;
		white-space: nowrap;
	}

	.item-desc {
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.empty {
		padding: var(--space-4);
		text-align: center;
		color: var(--ink-3);
	}

	.footer {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-2);
		border-top: 1px solid var(--line);
		color: var(--ink-3);
	}
</style>
