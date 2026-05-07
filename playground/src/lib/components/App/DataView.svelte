<script lang="ts">
	import Pane from '../Surfaces/Pane.svelte';
	import type { CodeLine } from '../../codegen';

	interface Props {
		title?: string;
		accentTitle?: string;
		lines: CodeLine[];
		selectedFieldId?: string | null;
	}

	let { 
		title = 'Output', 
		accentTitle = 'Data', 
		lines = [],
		selectedFieldId = null
	}: Props = $props();

	let container = $state<HTMLElement>();

	$effect(() => {
		if (selectedFieldId && container) {
			const activeLine = container.querySelector(`[data-field-id="${selectedFieldId}"]`);
			if (activeLine) {
				activeLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			}
		}
	});
</script>

<Pane {title} {accentTitle}>
	<div class="data-view" bind:this={container}>
		<pre class="t-code-sm"><code
>{#each lines as line}<div 
	class="line" 
	class:selected={selectedFieldId === line.fieldId}
	data-field-id={line.fieldId}
><span class="ln t-number">{line.lineNumber}</span><span class="content">{#each line.tokens as token}<span class="t-{token.kind}">{token.text}</span>{/each}</span></div>{/each}</code></pre>
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

	.line.selected {
		background: var(--accent-soft);
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
		overflow-x: auto;
	}

	/* Syntax Highlighting using Design Tokens */
	:global(.t-keyword) { color: var(--syn-keyword); font-weight: 600; }
	:global(.t-type) { color: var(--syn-type); }
	:global(.t-fn) { color: var(--syn-fn); }
	:global(.t-string) { color: var(--syn-string); }
	:global(.t-number) { color: var(--syn-number); }
	:global(.t-comment) { color: var(--syn-comment); font-style: italic; }
	:global(.t-punct) { color: var(--syn-punct); }
	:global(.t-plain) { color: var(--ink-0); }
</style>
