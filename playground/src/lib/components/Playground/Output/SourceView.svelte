<script lang="ts">
	import type { CodeLine } from '$lib/codegen';

	interface Props {
		lines: CodeLine[];
		selectedFieldId?: string | null;
		showLineNumbers?: boolean;
	}

	let { 
		lines = [],
		selectedFieldId = null,
		showLineNumbers = true
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

<div class="source-view" data-testid="source-view" bind:this={container}>
	<pre class="t-code-sm"><code>{#each lines as line}<div 
	class="line" 
	class:selected={selectedFieldId === line.fieldId}
	data-field-id={line.fieldId}
>{#if showLineNumbers}<span class="ln t-number">{line.lineNumber}</span>{/if}<span class="content">{#each line.tokens as token}<span class="t-{token.kind}">{token.text}</span>{/each}</span></div>{/each}</code></pre>
</div>

<style>
	.source-view {
		height: 100%;
		overflow: auto;
		background: var(--bg-0);
	}

	pre {
		margin: 0;
		padding: var(--space-4) 0;
		white-space: pre;
	}

	.line {
		display: flex;
		gap: var(--space-4);
		line-height: 1.6;
		padding: 0 var(--space-4);
		transition: background 0.15s ease;
	}

	.line:hover {
		background: var(--bg-1);
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
		white-space: pre;
	}

	/* Syntax Highlighting using Design Tokens */
	:global(.t-keyword) { color: var(--syn-keyword); font-weight: 600; }
	:global(.t-type) { color: var(--syn-type); }
	:global(.t-fn) { color: var(--syn-fn); }
	:global(.t-string) { color: var(--syn-string); }
	:global(.t-number) { color: var(--syn-number); }
	:global(.t-comment) { color: var(--syn-comment); font-style: italic; }
	:global(.t-punct) { color: var(--syn-punct); }
	:global(.t-property) { color: var(--accent); font-weight: 500; }
	:global(.t-plain) { color: var(--ink-0); }
</style>
