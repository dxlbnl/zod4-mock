<script lang="ts">
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
		<input placeholder="filter…" bind:value={filter} autofocus />
		<span class="scope">{scope}</span>
	</div>

	{#each categories as cat}
		<div class="grp">{cat}</div>
		{#each filteredItems.filter((i) => i.category === cat) as item}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="item" onclick={() => onselect?.(item.name)}>
				<span class="name">{item.name}</span>
				<span class="desc">{item.desc}</span>
			</div>
		{/each}
	{/each}

	{#if filteredItems.length === 0}
		<div class="empty">No matches found</div>
	{/if}

	<div class="foot">
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
		gap: 8px;
		padding: 8px;
		border-bottom: 1px solid var(--line);
		background: var(--bg-2);
	}
	.search input {
		flex: 1;
		background: transparent;
		border: 0;
		color: var(--ink-0);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		outline: 0;
	}
	.search .scope {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
		color: var(--ink-2);
		padding: 1px 5px;
		border: 1px solid var(--line);
		border-radius: 4px;
	}

	.grp {
		padding: 10px 12px 4px;
		font-size: 10px;
		color: var(--ink-2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		cursor: pointer;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
	}
	.item:hover {
		background: var(--accent-soft);
	}
	.item .name {
		color: var(--ink-0);
	}
	.item .desc {
		color: var(--ink-2);
		font-size: 10px;
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
		gap: 12px;
		padding: 8px 12px;
		background: var(--bg-2);
		border-top: 1px solid var(--line);
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
		color: var(--ink-3);
	}
</style>
