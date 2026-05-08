<script lang="ts">
	interface Props {
		name: string;
		count?: number;
		badge?: string;
		selected?: boolean;
		onclick?: () => void;
		onlink?: () => void;
		onupdatecount?: (val: number) => void;
	}

	let { name, count, badge, selected = false, onclick, onlink, onupdatecount }: Props = $props();

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

	<button 
		class="link-btn" 
		title="Add relationship"
		aria-label="Add relationship"
		onclick={(e) => { e.stopPropagation(); onlink?.(); }}
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
	</button>

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
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		margin: 0 var(--space-1);
		border-radius: var(--r-sm);
		cursor: pointer;
		user-select: none;
		border: 1px solid transparent;
		transition: all var(--ease-quick);
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
		font-size: 10px;
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

	.link-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--r-sm);
		border: none;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		transition: all var(--ease-quick);
	}

	.link-btn:hover {
		background: var(--bg-3);
		color: var(--ink-1);
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
