<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'primary' | 'ghost' | 'danger';
		disabled?: boolean;
		label?: string;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: () => void;
		children?: Snippet;
	}

	let {
		variant = 'default',
		disabled = false,
		label,
		type = 'button',
		class: className = '',
		onclick,
		children
	}: Props = $props();
</script>

<button
	{type}
	{disabled}
	class="btn {variant} {className}"
	onclick={() => !disabled && onclick?.()}
>
	{#if children}
		{@render children()}
	{:else}
		{label}
	{/if}
</button>
