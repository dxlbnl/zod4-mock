<script lang="ts">
	import type { CodeLine } from '$lib/codegen';

	interface Props {
		lines: CodeLine[];
	}

	let { lines = [] }: Props = $props();
</script>

<div class="export-content">
	<pre class="t-code-sm"><code>{#each lines as line}<div class="line"><span class="ln t-number">{line.lineNumber}</span><span class="content">{#each line.tokens as token}<span class="t-{token.kind}">{token.text}</span>{/each}</span></div>{/each}</code></pre>
</div>

<style>
	.export-content {
		flex: 1;
		background: var(--bg-0);
		overflow: auto;
		padding: var(--space-4);
	}

	pre {
		margin: 0;
	}

	.line {
		display: flex;
		gap: var(--space-4);
		line-height: 1.6;
	}

	.ln {
		width: 40px;
		text-align: right;
		color: var(--ink-3);
		user-select: none;
		flex-shrink: 0;
		border-right: 1px solid var(--line);
		padding-right: var(--space-4);
	}

	.content {
		color: var(--ink-0);
	}

	:global(.t-keyword) { color: var(--syn-keyword); font-weight: 600; }
	:global(.t-type) { color: var(--syn-type); }
	:global(.t-fn) { color: var(--syn-fn); }
	:global(.t-string) { color: var(--syn-string); }
	:global(.t-number) { color: var(--syn-number); }
	:global(.t-comment) { color: var(--syn-comment); font-style: italic; }
	:global(.t-punct) { color: var(--syn-punct); }
	:global(.t-plain) { color: var(--ink-0); }
</style>
