<script lang="ts">
	/**
	 * SourceView.svelte
	 * Interactive code view with syntax highlighting, active line tracking, and inline block folding.
	 */
	import type { CodeLine } from '$lib/codegen';
	import { SvelteSet } from 'svelte/reactivity';

	let { lines, selectedFieldId = undefined } = $props<{
		lines: CodeLine[];
		selectedFieldId?: string | null;
	}>();

	// Set of line numbers that are currently folded
	const foldedLineNumbers = new SvelteSet<number>();

	function toggleFold(ln: number) {
		if (foldedLineNumbers.has(ln)) {
			foldedLineNumbers.delete(ln);
		} else {
			foldedLineNumbers.add(ln);
		}
	}

	/**
	 * Derived array of lines for rendering.
	 * When a line is folded, we merge it with its closing partner and skip the interior.
	 */
	const renderableLines = $derived.by(() => {
		const result: (CodeLine & { isFoldedWrapper?: boolean; partnerTokens?: any[] })[] = [];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			if (foldedLineNumbers.has(line.lineNumber)) {
				// Find the closing partner: the next line that returns to the same depth
				let j = i + 1;
				while (j < lines.length && lines[j].depth > line.depth) {
					j++;
				}
				
				const partner = lines[j];
				const partnerTokens = partner ? [...partner.tokens] : [];
				// Trim leading whitespace (indentation) from the partner line
				while (partnerTokens.length > 0 && partnerTokens[0].kind === 'plain' && !partnerTokens[0].text.trim()) {
					partnerTokens.shift();
				}

				// Extract opening punctuation from the end of the opening line
				const openingTokens = [...line.tokens];
				const triggerTokens: any[] = [];
				
				// Find the last punctuation that likely starts the block
				let lastPunctIndex = -1;
				for (let k = openingTokens.length - 1; k >= 0; k--) {
					const t = openingTokens[k];
					if (t.kind === 'punct' && (t.text.includes('{') || t.text.includes('['))) {
						lastPunctIndex = k;
						break;
					}
				}
				
				if (lastPunctIndex !== -1) {
					triggerTokens.push(...openingTokens.splice(lastPunctIndex));
				}

				result.push({
					...line,
					tokens: openingTokens, // Remaining tokens stay outside
					isFoldedWrapper: true,
					triggerTokens,         // Opening brackets go inside the button
					partnerTokens          // Closing brackets go inside the button
				});
				
				// Skip all interior lines and the partner line itself (since it's merged)
				i = j;
			} else {
				result.push(line);
			}
		}
		return result;
	});
</script>

<div class="source-container">
	<div class="lines">
		{#each renderableLines as line (line.lineNumber)}
			<div 
				class="line" 
				class:selected={selectedFieldId && line.fieldId === selectedFieldId}
			>
				<div class="ln">
					{line.lineNumber}
					{#if line.isFoldable}
						<button 
							class="fold-toggle" 
							onclick={() => toggleFold(line.lineNumber)}
							aria-label={line.isFoldedWrapper ? 'Expand' : 'Collapse'}
						>
							{line.isFoldedWrapper ? '▸' : '▾'}
						</button>
					{/if}
				</div>
				<div class="content">
					{#each line.tokens as token}<span class="t-{token.kind}">{token.text}</span>{/each}{#if line.isFoldedWrapper}<button 
							class="fold-placeholder" 
							onclick={() => toggleFold(line.lineNumber)}
							aria-label="Expand"
						>{#if line.triggerTokens}{#each line.triggerTokens as token}<span class="t-{token.kind}">{token.text}</span>{/each}{/if}<span class="t-placeholder">...</span>{#if line.partnerTokens}{#each line.partnerTokens as token}<span class="t-{token.kind}">{token.text}</span>{/each}{/if}</button>{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.source-container {
		font-family: var(--font-mono);
		font-size: 13px;
		background: var(--bg-0);
		border-radius: var(--radius-lg);
		border: 1px solid var(--line);
		overflow: auto;
		height: 100%;
	}

	.lines {
		padding: var(--space-4) 0;
		min-width: fit-content;
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

	.line:hover .fold-toggle {
		opacity: 1;
	}

	.line.selected {
		background: var(--accent-soft);
	}

	.ln {
		width: 38px;
		text-align: right;
		color: var(--ink-3);
		user-select: none;
		flex-shrink: 0;
		border-right: 1px solid var(--line);
		padding-right: var(--space-4);
		margin-right: var(--space-1);
		position: relative;
	}

	.fold-toggle {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--ink-3);
		cursor: pointer;
		font-size: 12px;
		padding: 2px;
		opacity: 0.5;
		transition: opacity 0.2s, color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
	}

	.fold-toggle:hover {
		color: var(--accent);
		opacity: 1 !important;
	}

	.fold-placeholder {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		padding: 0;
		margin: 0;
		font-size: inherit;
		cursor: pointer;
		font-family: inherit;
		line-height: inherit;
		display: inline;
		transition: all 0.2s ease;
	}

	.fold-placeholder:hover {
		background: var(--accent-soft);
		border-color: var(--accent);
	}

	.fold-placeholder:hover .t-placeholder {
		color: var(--accent);
	}

	.content {
		color: var(--ink-0);
		white-space: pre;
	}

	/* Syntax Highlighting using Design Tokens */
	:global(.t-keyword) {
		color: var(--syn-keyword);
		font-weight: 600;
	}
	:global(.t-type) {
		color: var(--syn-type);
	}
	:global(.t-fn) {
		color: var(--syn-fn);
	}
	:global(.t-string) {
		color: var(--syn-string);
	}
	:global(.t-number) {
		color: var(--syn-number);
	}
	:global(.t-comment) {
		color: var(--syn-comment);
		font-style: italic;
	}
	:global(.t-punct) {
		color: var(--syn-punct);
	}
	:global(.t-property) {
		color: var(--accent);
		font-weight: 500;
	}
	:global(.t-placeholder) {
		color: var(--ink-3);
	}
	:global(.t-plain) {
		color: var(--ink-0);
	}
</style>
