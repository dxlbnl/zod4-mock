<script lang="ts">
	interface Props {
		name: string;
		value?: string | number | boolean;
		warn?: boolean;
		removable?: boolean;
		kind?: 'modifier' | 'enum';
		category?: 'Constraints' | 'Format' | 'Wrappers';
		onremove?: () => void;
		onchange?: (value: string) => void;
	}

	let { 
		name, 
		value, 
		warn = false, 
		removable = false, 
		kind = 'modifier',
		category,
		onremove, 
		onchange 
	}: Props = $props();

	let editing = $state(false);
	let displayValue = $state(String(value ?? ''));
	let valEl = $state<HTMLElement>();

	$effect(() => {
		// Sync internal state when external value changes
		displayValue = String(value ?? '');
	});

	function handleBlur() {
		editing = false;
		if (displayValue !== String(value)) {
			onchange?.(displayValue);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLElement).blur();
		}
		if (e.key === 'Escape') {
			displayValue = String(value ?? '');
			editing = false;
			(e.target as HTMLElement).blur();
		}
	}

	function handleClick(e: MouseEvent) {
		if (value !== undefined && valEl && !editing) {
			valEl.focus();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<span 
	class="pill t-code-tight" 
	data-warn={warn} 
	data-kind={kind}
	data-category={category}
	data-editing={editing}
	data-testid="modifier-pill"
	onmousedown={(e) => editing && e.stopPropagation()}
	onclick={handleClick}
>
	<span class="name">{name.replace(/\(\)$/, '')}</span>
	{#if value !== undefined}
		<span class="punct">(</span>
		<span
			bind:this={valEl}
			class="val"
			class:empty={displayValue === ''}
			contenteditable="true"
			onfocus={() => editing = true}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			bind:textContent={displayValue}
		></span>
		<span class="punct">)</span>
	{:else if name.endsWith('()')}
		<span class="punct">()</span>
	{/if}
	
	{#if removable}
		<button class="x" onclick={(e) => { e.stopPropagation(); onremove?.(); }} aria-label="Remove">×</button>
	{/if}
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 0 var(--space-2);
		height: var(--h-mod);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--bg-2);
		color: var(--ink-1);
		cursor: text;
		white-space: nowrap;
		transition: all var(--ease-quick);
		user-select: none;
	}

	.pill:hover {
		border-color: var(--accent-edge);
		background: var(--bg-3);
	}

	.pill[data-kind='enum'] {
		background: var(--accent-soft);
		border-color: var(--accent-edge);
		color: var(--accent);
		border-style: dashed;
		cursor: default;
	}

	.pill[data-category='Constraints'] { border-left: 3px solid var(--blue-bright); }
	.pill[data-category='Format'] { border-left: 3px solid var(--green-bright); }
	.pill[data-category='Wrappers'] { border-left: 3px solid var(--purple-bright); }

	.pill .name {
		font-weight: 500;
	}

	.pill .punct {
		color: var(--ink-3);
		opacity: 0.7;
	}

	.pill .val {
		color: var(--syn-number);
		padding: 0 2px;
		border-radius: 2px;
		min-width: 8px;
		outline: none;
		cursor: text;
		user-select: text;
	}

	.pill .val.empty {
		background: var(--bg-3);
		min-width: 12px;
	}

	.pill[data-editing='true'] .val {
		background: var(--bg-0);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.pill .x {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--ink-3);
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		margin-left: var(--space-2);
		border: 0;
		padding: 0;
		opacity: 0;
		transition: all var(--ease-quick);
	}

	.pill:hover .x {
		opacity: 1;
	}

	.pill .x:hover {
		background: var(--ink-3);
		color: var(--bg-1);
	}

	.pill[data-warn='true'] {
		border-color: var(--warn);
		color: var(--warn);
		background: var(--warn-soft);
	}
</style>
