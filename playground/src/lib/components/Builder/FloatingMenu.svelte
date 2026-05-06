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
		onselect?: (name: string) => void;
		onclose?: () => void;
		caretOffset?: number;
	}

	let { scope, items, onselect, onclose, caretOffset = 14 }: Props = $props();
	let filter = $state('');

	let filteredItems = $derived(
		items.filter(
			(item) =>
				item.name.toLowerCase().includes(filter.toLowerCase()) ||
				item.desc.toLowerCase().includes(filter.toLowerCase())
		)
	);

	let categories = $derived([...new Set(filteredItems.map((item) => item.category))]);
</script>

<div class="float-menu" style="--caret: {caretOffset}px">
	<div class="search">
		<Input class="search-input" placeholder="filter…" bind:value={filter} autofocus />
		<span class="scope t-code-tight">{scope}</span>
	</div>

	{#each categories as cat}
		<div class="grp t-eyebrow">{cat}</div>
		{#each filteredItems.filter((i) => i.category === cat) as item}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="item t-code-sm" onclick={() => onselect?.(item.name)}>
				<span class="name">{item.name}</span>
				<span class="desc t-code-tight">{item.desc}</span>
			</div>
		{/each}
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
		width: 256px;
		background: var(--bg-1);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-pop);
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
	.item:hover {
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
