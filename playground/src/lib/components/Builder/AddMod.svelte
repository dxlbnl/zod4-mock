<script lang="ts">
	interface Props {
		active?: boolean;
		fieldId?: string;
		onclick?: (e: MouseEvent | FocusEvent) => void;
		onfocus?: (e: FocusEvent) => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let { active = false, fieldId, onclick, onfocus, onkeydown }: Props = $props();
</script>

<button 
	type="button" 
	class="add-mod t-code-tight" 
	data-active={active} 
	data-field-id={fieldId}
	{onclick}
	onfocus={(e) => onfocus?.(e)}
	onkeydown={(e) => onkeydown?.(e)}
>
	+ mod
</button>

<style>
	.add-mod {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0 var(--space-2);
		height: var(--h-mod);
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-2);
		cursor: pointer;
		white-space: nowrap;
		position: relative;
		transition:
			background var(--ease-quick),
			border-color var(--ease-quick);
	}
	.add-mod:hover {
		color: var(--ink-0);
		border-color: var(--accent-edge);
		background: var(--accent-soft);
	}
	.add-mod[data-active='true'] {
		background: var(--accent-dim);
		border-color: var(--accent-dim);
		color: #fff;
	}
</style>
