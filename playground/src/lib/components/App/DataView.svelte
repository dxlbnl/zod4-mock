<script lang="ts">
	import Pane from '../Surfaces/Pane.svelte';

	interface Props {
		title?: string;
		accentTitle?: string;
		data: any;
		selectedFieldId?: string | null;
	}

	let { 
		title = 'Output', 
		accentTitle = 'Data', 
		data = {},
		selectedFieldId = null
	}: Props = $props();

	let jsonString = $derived(JSON.stringify(data, null, 2));

	// Simple highlighting by splitting lines
	// For hi-fi, we'd want a proper tokenizer, but for now we'll match CodeView style
	let lines = $derived(jsonString.split('\n'));

	let container = $state<HTMLElement>();

	// TODO: Implement sophisticated field-to-JSON-line mapping for highlighting
</script>

<Pane {title} {accentTitle}>
	<div class="data-view" bind:this={container}>
		<pre class="t-code-sm"><code
>{#each lines as line, i}<div class="line"><span class="ln t-number">{i + 1}</span><span class="content">{line}</span></div>{/each}</code></pre>
	</div>
</Pane>

<style>
	.data-view {
		padding: var(--space-4);
		background: var(--bg-0);
		height: 100%;
		overflow: auto;
	}

	pre {
		margin: 0;
		white-space: pre;
	}

	.line {
		display: flex;
		gap: var(--space-4);
		line-height: 1.6;
	}

	.ln {
		width: 32px;
		text-align: right;
		color: var(--ink-3);
		user-select: none;
		flex-shrink: 0;
		border-right: 1px solid var(--line);
		padding-right: var(--space-4);
		margin-right: var(--space-1);
	}

	.content {
		color: var(--ink-0);
	}
</style>
