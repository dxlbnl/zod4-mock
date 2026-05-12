<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	interface Option {
		label: string;
		value: string;
		icon?: string;
	}

	interface Props {
		id?: string;
		options: Option[];
		value: string;
		placeholder?: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
		class?: string;
		triggerClass?: string;
		variant?: 'default' | 'ghost';
	}

	let { 
		id,
		options, 
		value, 
		placeholder = 'Select...', 
		disabled = false, 
		onchange, 
		class: className = '',
		triggerClass = '',
		variant = 'default'
	}: Props = $props();

	let isOpen = $state(false);
	let containerEl = $state<HTMLDivElement | null>(null);
	let activeIndex = $state(-1);

	const selectedOption = $derived(options.find(opt => opt.value === value));

	function toggle() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) {
			activeIndex = options.findIndex(opt => opt.value === value);
			if (activeIndex === -1) activeIndex = 0;
		}
	}

	function select(optValue: string) {
		onchange?.(optValue);
		isOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) {
			if (e.key === 'Enter' || e.key === 'ArrowDown') {
				e.preventDefault();
				toggle();
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				activeIndex = (activeIndex + 1) % options.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				activeIndex = (activeIndex - 1 + options.length) % options.length;
				break;
			case 'Enter':
				e.preventDefault();
				if (options[activeIndex]) select(options[activeIndex].value);
				break;
			case 'Escape':
				e.preventDefault();
				isOpen = false;
				break;
		}
	}

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerEl && !containerEl.contains(e.target as Node)) {
				isOpen = false;
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div 
	bind:this={containerEl} 
	class="fancy-select {className}" 
	class:disabled 
	class:is-open={isOpen}
	onkeydown={handleKeydown}
	role="combobox"
	tabindex="-1"
	aria-haspopup="listbox"
	aria-expanded={isOpen}
	aria-controls={isOpen ? "options-menu" : undefined}
>
	<button 
		{id}
		type="button" 
		class="select-trigger {triggerClass}" 
		class:variant-ghost={variant === 'ghost'}
		onclick={toggle} 
		aria-haspopup="listbox" 
		aria-expanded={isOpen}
		{disabled}
	>
		<span class="trigger-label" class:is-placeholder={!selectedOption}>
			{selectedOption ? selectedOption.label : placeholder}
		</span>
		<span class="chevron">
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
				<path d="m6 9 6 6 6-6"/>
			</svg>
		</span>
	</button>

	{#if isOpen}
		<div id="options-menu" class="options-menu" transition:fade={{ duration: 100 }} role="listbox">
			{#each options as opt, i}
				<div 
					class="option" 
					class:is-selected={value === opt.value}
					class:is-active={activeIndex === i}
					role="option"
					aria-selected={value === opt.value}
					onclick={() => select(opt.value)}
					onkeydown={(e) => e.key === 'Enter' && select(opt.value)}
					onmouseenter={() => activeIndex = i}
					tabindex="0"
				>
					{#if opt.icon}
						<span class="opt-icon">{opt.icon}</span>
					{/if}
					<span class="opt-label">{opt.label}</span>
					{#if value === opt.value}
						<span class="check">✓</span>
					{/if}
				</div>
			{/each}
			{#if options.length === 0}
				<div class="empty">No options</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.fancy-select {
		position: relative;
		min-width: 0;
		height: 100%;
	}

	.select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 32px;
		padding: 0 var(--space-3);
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		color: var(--ink-1);
		font-family: "Inter", system-ui, sans-serif;
		font-size: 13px;
		cursor: pointer;
		text-align: left;
		transition: all var(--ease-quick);
		gap: var(--space-2);
	}

	.select-trigger:hover:not(:disabled) {
		background: var(--bg-2);
		border-color: var(--line-strong);
	}

	.select-trigger.variant-ghost {
		background: transparent;
		border-color: transparent;
		padding: 0 var(--space-5);
		height: 100%;
		border-radius: 0;
	}
	.select-trigger.variant-ghost:hover:not(:disabled) {
		background: var(--bg-2);
	}

	.fancy-select.is-open .select-trigger {
		border-color: var(--accent-bright);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}

	.trigger-label {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trigger-label.is-placeholder {
		color: var(--ink-3);
	}

	.chevron {
		color: var(--ink-3);
		display: flex;
		align-items: center;
		transition: transform var(--ease-quick);
	}

	.select-trigger.variant-ghost:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.options-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--bg-1);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-pop);
		z-index: 1000;
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		max-height: 240px;
		overflow-y: auto;
	}


	.option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--ease-quick);
		color: var(--ink-2);
		font-size: 13px;
	}

	.option.is-active {
		background: var(--bg-2);
		color: var(--ink-1);
	}

	.option.is-selected {
		background: var(--accent-soft);
		color: var(--accent-bright);
	}

	.opt-label {
		flex: 1;
	}

	.check {
		font-size: 10px;
		font-weight: 800;
	}

	.empty {
		padding: var(--space-4);
		text-align: center;
		color: var(--ink-3);
		font-size: 12px;
	}
</style>
