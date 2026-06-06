<script lang="ts">
	import JsonTree from './JsonTree.svelte';
	import { untrack } from 'svelte';

	interface Props {
		value: unknown;
		depth?: number;
		highlightIds?: Set<string> | string[];
	}

	let { value, depth = 0, highlightIds = new Set<string>() }: Props = $props();
	const ids = $derived(Array.isArray(highlightIds) ? new Set(highlightIds) : highlightIds);

	// Each tree node instance has a fixed depth — explicitly untrack to avoid false positive
	let collapsed = $state(untrack(() => depth > 2));

	const isObj = $derived(value !== null && typeof value === 'object' && !Array.isArray(value));
	const isArr = $derived(Array.isArray(value));
	const entries = $derived(isObj ? Object.entries(value as Record<string, unknown>) : []);
	const items = $derived(isArr ? (value as unknown[]) : []);

	function isHighlighted(v: unknown): boolean {
		return typeof v === 'string' && ids.has(v);
	}

	function formatPrimitive(v: unknown): string {
		if (v instanceof Date) return `"${v.toISOString()}"`;
		if (typeof v === 'string') return `"${v}"`;
		return String(v);
	}
</script>

{#if isObj}
	<button class="brace" onclick={() => (collapsed = !collapsed)} type="button">
		{collapsed ? '▶' : '▼'} {'{'}
	</button>
	{#if !collapsed}
		<div class="indent">
			{#each entries as [k, v]}
				<div class="row">
					<span class="key">"{k}"</span>
					<span class="colon">: </span>
					<JsonTree value={v} depth={depth + 1} {highlightIds} />
				</div>
			{/each}
		</div>
		<span class="brace">{'}'}</span>
	{:else}
		<span class="ellipsis"> … {entries.length} keys {'}'}</span>
	{/if}
{:else if isArr}
	<button class="brace" onclick={() => (collapsed = !collapsed)} type="button">
		{collapsed ? '▶' : '▼'} [
	</button>
	{#if !collapsed}
		<div class="indent">
			{#each items as item}
				<div class="row"><JsonTree value={item} depth={depth + 1} {highlightIds} /></div>
			{/each}
		</div>
		<span class="brace">]</span>
	{:else}
		<span class="ellipsis"> … {items.length} items ]</span>
	{/if}
{:else}
	<span class="value {isHighlighted(value) ? 'highlight' : ''} {typeof value}">
		{formatPrimitive(value)}
	</span>
{/if}

<style>
	.brace {
		background: none;
		border: none;
		padding: 0;
		color: var(--ink-dim);
		cursor: pointer;
		user-select: none;
		font-family: var(--mono);
		font-size: 12px;
	}
	.brace:hover {
		color: var(--ink);
	}
	.indent {
		padding-left: var(--u2);
	}
	.row {
		line-height: 1.6;
	}
	.key {
		color: var(--shiki-token-keyword);
	}
	.colon {
		color: var(--ink-dim);
	}
	.value {
		font-family: var(--mono);
		font-size: 12px;
	}
	.value.string {
		color: var(--shiki-token-string);
	}
	.value.number {
		color: var(--amber);
	}
	.value.boolean {
		color: var(--amber);
	}
	.value.highlight {
		background: color-mix(in srgb, var(--amber) 20%, transparent);
		border-radius: 3px;
		padding: 0 2px;
		color: var(--amber);
		font-weight: 600;
	}
	.ellipsis {
		color: var(--ink-dim);
		font-size: 11px;
	}
</style>
