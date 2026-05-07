<script lang="ts">
	interface Props {
		name: string;
		count?: number;
		badge?: string;
		selected?: boolean;
		onclick?: () => void;
		onupdatecount?: (val: number) => void;
	}

	let { name, count, badge, selected = false, onclick, onupdatecount }: Props = $props();

	function handleInput(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(val)) {
			onupdatecount?.(val);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="subj" aria-selected={selected} {onclick}>
	<span class="grip t-number">⋮⋮</span>
	<span class="name t-small">{name}</span>
	{#if count !== undefined}
		<input 
			type="number" 
			class="count-input t-code-tight" 
			value={count} 
			min="1"
			max="1000"
			oninput={handleInput}
			onclick={(e) => e.stopPropagation()}
		/>
	{/if}
	{#if badge}
		<span class="badge t-code-tight">{badge}</span>
	{/if}
</div>

<style>
	.subj {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--r-sm);
		cursor: pointer;
		user-select: none;
		border: 1px solid transparent;
		transition: background var(--ease-quick);
	}

	.subj:hover {
		background: var(--bg-2);
	}

	.subj[aria-selected='true'] {
		background: var(--accent-soft);
		border-color: var(--accent-edge);
	}

	.subj .grip {
		color: var(--ink-3);
		cursor: grab;
	}

	.subj .name {
		font-weight: 500;
		color: var(--ink-0);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.subj[aria-selected='true'] .name {
		color: var(--accent-bright);
	}

	.count-input {
		width: 32px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		color: var(--ink-2);
		text-align: right;
		padding: 1px 4px;
		transition: all var(--ease-quick);
		appearance: textfield; /* Hide arrows by default */
	}

	.count-input::-webkit-inner-spin-button,
	.count-input::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}

	.subj:hover .count-input,
	.count-input:focus {
		background: var(--bg-3);
		border-color: var(--line-strong);
		color: var(--ink-0);
	}

	.count-input:focus {
		outline: none;
		border-color: var(--accent-edge);
		box-shadow: 0 0 0 1px var(--accent-soft);
	}

	.subj .badge {
		color: var(--ink-2);
		padding: 1px 5px;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
	}
</style>
