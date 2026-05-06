<script lang="ts">
	interface Props {
		name: string;
		value?: string | number;
		warn?: boolean;
		removable?: boolean;
		onremove?: () => void;
		onchange?: (value: any) => void;
	}

	let { name, value, warn = false, removable = false, onremove, onchange }: Props = $props();
</script>

<span class="mod t-code-tight" data-warn={warn}>
	<span>{name}</span>
	{#if value !== undefined}
		<span class="eq">=</span>
		<span
			class="val"
			contenteditable="true"
			onblur={(e) => onchange?.(e.currentTarget.textContent)}
		>
			{value}
		</span>
	{/if}
	{#if removable}
		<button class="x" onclick={onremove} aria-label="Remove modifier">×</button>
	{/if}
</span>

<style>
	.mod {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0 var(--space-1) 0 var(--space-2);
		height: var(--h-mod);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-sm);
		background: var(--bg-2);
		color: var(--ink-1);
		cursor: default;
		white-space: nowrap;
	}
	.mod:hover {
		border-color: var(--accent-edge);
		color: var(--ink-0);
	}
	.mod .eq {
		color: var(--ink-3);
		margin: 0 1px;
	}
	.mod .val {
		background: var(--bg-3);
		border: 1px dashed var(--line-strong);
		border-radius: 2px;
		padding: 0 var(--space-1);
		color: var(--syn-number);
		cursor: text;
	}
	.mod .x {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: none;
		place-items: center;
		background: var(--ink-3);
		color: var(--bg-1);
		font-size: 8px;
		line-height: 1;
		cursor: pointer;
		margin-left: 2px;
		border: 0;
		padding: 0;
	}
	.mod:hover .x {
		display: grid;
	}
	.mod[data-warn='true'] {
		border-color: var(--warn);
		color: var(--warn);
	}
	.mod[data-warn='true'] .val {
		color: var(--warn);
	}
</style>
