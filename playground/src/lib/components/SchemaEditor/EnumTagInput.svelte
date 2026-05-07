<script lang="ts">
	/**
	 * EnumTagInput.svelte
	 * Editable comma-separated tag pill system for enum field values.
	 * - Space / Tab / comma inside the ghost input → commit new tag
	 * - Backspace on empty ghost input → remove previous tag
	 * - Click on tag → make it editable (contenteditable)
	 * - × on tag → remove it
	 */

	interface Props {
		values: string[];
		onchange: (values: string[]) => void;
		/** Called when the user presses Enter/comma after the last tag — signals "done with enum" */
		ondone?: () => void;
	}

	let { values, onchange, ondone }: Props = $props();

	let ghostInput = $state<HTMLInputElement | null>(null);
	let ghostValue = $state('');
	/** Index of the tag being inline-edited (-1 = none) */
	let editingIndex = $state(-1);
	let editEls = $state<Record<number, HTMLSpanElement>>({});

	$effect(() => {
		ghostInput?.focus();
	});



	function commitGhost() {
		const v = ghostValue.trim();
		if (v) {
			onchange([...values, v]);
		}
		ghostValue = '';
	}

	function handleGhostKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			if (ghostValue.trim()) {
				commitGhost();
			} else {
				// Empty input + Enter/comma → done with enum tags
				ondone?.();
			}
		} else if (e.key === 'Tab') {
			e.preventDefault();
			if (ghostValue.trim()) {
				commitGhost();
			} else {
				ondone?.();
			}
		} else if (e.key === 'Backspace' && ghostValue === '') {
			e.preventDefault();
			if (values.length > 0) {
				// Remove previous tag
				const newVals = values.slice(0, -1);
				onchange(newVals);
			}
		}
	}

	function startEdit(index: number) {
		editingIndex = index;
		// Focus the contenteditable span on next tick
		setTimeout(() => {
			const el = editEls[index];
			if (el) {
				el.focus();
				// Move cursor to end
				const range = document.createRange();
				const sel = window.getSelection();
				range.selectNodeContents(el);
				range.collapse(false);
				sel?.removeAllRanges();
				sel?.addRange(range);
			}
		});
	}

	function commitEdit(index: number) {
		const el = editEls[index];
		const newVal = el?.textContent?.trim() ?? '';
		editingIndex = -1;
		if (!newVal) {
			// Empty → remove the tag
			const newVals = [...values];
			newVals.splice(index, 1);
			onchange(newVals);
		} else if (newVal !== values[index]) {
			const newVals = [...values];
			newVals[index] = newVal;
			onchange(newVals);
		}
	}

	function handleTagKeydown(e: KeyboardEvent, index: number) {
		if (e.key === 'Enter' || e.key === 'Escape') {
			e.preventDefault();
			(e.target as HTMLElement).blur();
		} else if (e.key === 'Backspace') {
			const el = e.target as HTMLElement;
			if (el.textContent === '') {
				e.preventDefault();
				commitEdit(index); // removes the tag
			}
		}
	}

	function removeTag(index: number) {
		const newVals = [...values];
		newVals.splice(index, 1);
		onchange(newVals);
	}
</script>

<span class="enum-tags">
	{#each values as val, i}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="tag t-code-tight"
			class:editing={editingIndex === i}
			onclick={() => startEdit(i)}
		>
			<span
				bind:this={editEls[i]}
				class="tag-text"
				contenteditable={editingIndex === i ? 'true' : 'false'}
				onblur={() => commitEdit(i)}
				onkeydown={(e) => handleTagKeydown(e, i)}
			>{val}</span>
			<button
				class="tag-x"
				type="button"
				aria-label="Remove {val}"
				onclick={(e) => { e.stopPropagation(); removeTag(i); }}
			>×</button>
		</span>
	{/each}

	<input
		bind:this={ghostInput}
		class="ghost-input t-code-tight"
		placeholder={values.length === 0 ? 'val1, val2…' : '+value'}
		bind:value={ghostValue}
		onkeydown={handleGhostKeydown}
		size={Math.max(6, ghostValue.length + 1)}
	/>
</span>

<style>
	.enum-tags {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 0 var(--space-1);
		height: 18px;
		border: 1px dashed var(--accent-edge);
		border-radius: var(--radius-sm);
		background: var(--accent-soft);
		color: var(--accent);
		cursor: text;
		user-select: none;
		transition: all var(--ease-quick);
	}

	.tag.editing {
		border-style: solid;
		outline: 1px solid var(--accent);
		background: var(--bg-0);
	}

	.tag-text {
		outline: none;
		cursor: text;
		min-width: 4px;
	}

	.tag-x {
		background: transparent;
		border: none;
		color: var(--accent);
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		opacity: 0.5;
		display: flex;
		align-items: center;
	}

	.tag-x:hover {
		opacity: 1;
	}

	.ghost-input {
		background: transparent;
		border: none;
		border-bottom: 1px dashed var(--ink-3);
		outline: none;
		color: var(--ink-1);
		padding: 0 2px;
		font: inherit;
		min-width: 50px;
	}

	.ghost-input:focus {
		border-bottom-color: var(--accent);
	}
</style>
