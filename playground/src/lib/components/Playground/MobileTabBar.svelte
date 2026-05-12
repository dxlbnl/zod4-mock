<script lang="ts">
	interface Props {
		activeTab: "editor" | "output";
		onchange: (tab: "editor" | "output") => void;
	}
	let { activeTab, onchange }: Props = $props();
</script>

<nav class="mobile-tab-bar">
	<button 
		class:active={activeTab === 'editor'} 
		onclick={() => onchange('editor')}
	>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
		<span>Editor</span>
	</button>
	<button 
		class:active={activeTab === 'output'} 
		onclick={() => onchange('output')}
	>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="9" y2="9"></line><line x1="9" x2="9" y1="21" y2="9"></line></svg>
		<span>Output</span>
	</button>
</nav>

<style>
	.mobile-tab-bar {
		display: none;
		grid-template-columns: repeat(2, 1fr);
		background: var(--bg-1);
		border-top: 1px solid var(--line);
		padding: var(--space-1);
		padding-bottom: max(var(--space-1), env(safe-area-inset-bottom));
	}

	@media (max-width: 1024px) {
		.mobile-tab-bar {
			display: grid;
		}
	}

	button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: transparent;
		border: none;
		color: var(--ink-3);
		padding: var(--space-2) 0;
		cursor: pointer;
		transition: all var(--ease-quick);
		border-radius: var(--radius-md);
	}

	button.active {
		color: var(--accent-bright);
		background: var(--accent-soft);
	}

	button span {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
