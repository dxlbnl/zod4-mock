<script lang="ts">
	interface Props {
		label?: string;
		value?: string | number;
		placeholder?: string;
		type?: string;
		class?: string;
		autofocus?: boolean;
		disabled?: boolean;
		oninput?: (value: any) => void;
	}

	let {
		label,
		value = $bindable(),
		placeholder = '',
		type = 'text',
		class: className = '',
		autofocus = false,
		disabled = false,
		oninput
	}: Props = $props();
</script>

{#if label}
	<div class="field {className}">
		<span class="field-label">{label}</span>
		<input
			{type}
			{placeholder}
			{autofocus}
			{disabled}
			bind:value
			class="input"
		/>
	</div>
{:else}
	<input
		{type}
		{placeholder}
		{autofocus}
		{disabled}
		bind:value
		class="input {className}"
	/>
{/if}

<style>
	/* Styles are already in app.css or leftrail.css (global) */
	.field {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		border-radius: var(--r-sm);
	}
	.field-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--ink-2);
		width: 56px;
		flex-shrink: 0;
	}
	.input {
		flex: 1;
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		padding: 3px 6px;
		color: var(--ink-0);
		font: inherit;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		height: 22px;
		min-width: 0;
	}
	.input:focus:not(:disabled) {
		outline: 0;
		border-color: var(--accent-edge);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}
	.input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: var(--bg-1);
	}
</style>
