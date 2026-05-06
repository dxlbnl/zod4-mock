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
		<span class="field-label t-code-tight">{label}</span>
		<input
			{type}
			{placeholder}
			{autofocus}
			{disabled}
			bind:value
			class="input t-code-sm"
		/>
	</div>
{:else}
	<input
		{type}
		{placeholder}
		{autofocus}
		{disabled}
		bind:value
		class="input t-code-sm {className}"
	/>
{/if}

<style>
	/* Styles are already in app.css or leftrail.css (global) */
	.field {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--r-sm);
	}
	.field-label {
		color: var(--ink-2);
		width: 56px;
		flex-shrink: 0;
	}
	.input {
		flex: 1;
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		padding: 3px var(--space-2);
		color: var(--ink-0);
		font: inherit;
		height: var(--h-input);
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
