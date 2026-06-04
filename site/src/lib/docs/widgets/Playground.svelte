<script lang="ts">
	// B100-R2 — <Playground> rebadge of SchemaPlayground.
	// Re-exports the props contract of the existing SchemaPlayground
	// widget. SSR-safe: CodeMirror is constructed inside SchemaPlayground's
	// own Editor (which already defers to onMount). The Playground
	// primitive itself defers SchemaPlayground mount until after onMount
	// (D18 successor — see B100-R12).

	import { onMount } from 'svelte';
	import SchemaPlayground from '$lib/widgets/SchemaPlayground.svelte';

	interface Props {
		initialCode?: string;
	}

	let { initialCode }: Props = $props();

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<SchemaPlayground {initialCode} />
{:else}
	<div class="playground-placeholder" aria-hidden="true"></div>
{/if}

<style>
	.playground-placeholder {
		min-height: 200px;
		border: 1px solid var(--rule);
		border-radius: 8px;
	}
</style>
