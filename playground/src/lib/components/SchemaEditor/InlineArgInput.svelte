<script lang="ts">
	import { tick } from 'svelte';
	/**
	 * InlineArgInput.svelte
	 * Renders `(value)` inline within a modifier pill during editing.
	 * Commit on Enter/blur, cancel (remove modifier) on Escape or Backspace-when-empty.
	 */

	interface Props {
		value?: string | number | boolean;
		placeholder?: string;
		/** Called when the value is committed (Enter or blur) */
		oncommit: (value: string, isNext?: boolean) => void;
		/** Called when the modifier should be removed (Esc, or Backspace on empty) */
		oncancel: () => void;
	}

	let { value, placeholder = '…', oncommit, oncancel }: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let localValue = $state('');

	$effect(() => {
		localValue = value !== undefined ? String(value) : '';
		tick().then(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	});

	function commit(isNext = false) {
		oncommit(localValue, isNext);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			oncancel();
		} else if (e.key === 'Backspace' && localValue === '') {
			e.preventDefault();
			e.stopPropagation();
			oncancel();
		} else if (e.key === '.') {
			// '.' opens next modifier — commit first
			e.preventDefault();
			e.stopPropagation();
			commit(true);
		}
	}
</script>

<span class="arg-wrap t-code-sm">
	<span class="punct">(</span>
	<input
		bind:this={inputEl}
		class="arg-input"
		bind:value={localValue}
		{placeholder}
		onkeydown={handleKeydown}
		onblur={() => commit()}
		size={Math.max(1, localValue.length || placeholder.length)}
		aria-label="Modifier value"
	/>
	<span class="punct">)</span>
</span>

<style>
	.arg-wrap {
		display: inline-flex;
		align-items: center;
		gap: 1px;
	}

	.punct {
		color: var(--ink-3);
		opacity: 0.7;
		user-select: none;
	}

	.arg-input {
		background: var(--bg-0);
		border: none;
		border-radius: var(--radius-sm);
		outline: 1px solid var(--accent);
		color: var(--syn-number);
		padding: 0 3px;
		min-width: 16px;
		font: inherit;
		text-align: center;
	}

	.arg-input:focus {
		outline-width: 2px;
	}
</style>
