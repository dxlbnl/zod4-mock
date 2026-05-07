<script lang="ts">
	import type { CodeLine } from '../../codegen';

	interface Props {
		data: Record<string, any>;
		lines?: CodeLine[]; // Pre-tokenized lines if available
	}

	let { data, lines = [] }: Props = $props();

	// If no lines provided, we'll just show the raw JSON
	const fallbackLines = $derived.by(() => {
		if (lines.length > 0) return lines;
		const json = JSON.stringify(data, null, 2);
		return json.split('\n').map((text, i) => ({
			lineNumber: i + 1,
			tokens: [{ kind: 'plain' as const, text }]
		}));
	});
</script>

<div class="world-view">
	<div class="scroll-container">
		{#each fallbackLines as line}
			<div class="line">
				<span class="line-number t-number">{line.lineNumber}</span>
				<div class="line-content t-code">
					{#each line.tokens as token}
						<span class="token-{token.kind}">{token.text}</span>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.world-view {
		height: 100%;
		background: var(--bg-0);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.scroll-container {
		flex: 1;
		overflow: auto;
		padding: var(--space-4) 0;
	}

	.line {
		display: flex;
		padding: 0 var(--space-4);
		min-height: 20px;
		align-items: center;
	}

	.line:hover {
		background: var(--bg-1);
	}

	.line-number {
		width: 32px;
		flex-shrink: 0;
		color: var(--ink-3);
		text-align: right;
		margin-right: var(--space-5);
		user-select: none;
	}

	.line-content {
		white-space: pre;
		color: var(--ink-0);
	}

	/* Token Colors */
	.token-keyword { color: var(--syn-keyword); }
	.token-type { color: var(--syn-type); }
	.token-fn { color: var(--syn-fn); }
	.token-string { color: var(--syn-string); }
	.token-number { color: var(--syn-number); }
	.token-comment { color: var(--syn-comment); }
	.token-punct { color: var(--syn-punct); }
	.token-plain { color: var(--ink-0); }
</style>
