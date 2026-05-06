<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'primary' | 'ghost';
		disabled?: boolean;
		label?: string;
		children?: Snippet;
		onclick?: (e: MouseEvent) => void;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		[key: string]: any;
	}

	let {
		variant = 'default',
		disabled = false,
		label,
		children,
		onclick,
		type = 'button',
		class: className = '',
		...rest
	}: Props = $props();

	function handleClick(e: MouseEvent) {
		if (disabled) return;
		onclick?.(e);
	}
</script>

<button {type} {disabled} onclick={handleClick} class="btn t-small {variant} {className}" {...rest}>
	{#if label}
		{label}
	{:else if children}
		{@render children()}
	{/if}
</button>

<style>
	/* Styles are already in app.css, but we can add component-specific tweaks here if needed */
</style>
