<script lang="ts">
	import Button from '$lib/components/Primitives/Button.svelte';

	interface Props {
		open?: boolean;
		preview?: boolean;
		title?: string;
		meta?: string;
		onclose?: () => void;
		oncopy?: () => void;
		ondownload?: () => void;
		children?: any;
		footer?: any;
	}

	let {
		open = false,
		preview = false,
		title = 'Export',
		meta = 'single file · world.ts · 194 lines',
		onclose,
		oncopy,
		ondownload,
		children,
		footer
	}: Props = $props();
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="sheet-backdrop" class:preview onclick={onclose}>
		<div class="sheet" onclick={(e) => e.stopPropagation()}>
			<div class="sheet-head">
				<span class="title t-title">{title}</span>
				{#if meta}
					<span class="meta t-code">{meta}</span>
				{/if}
				<div class="actions">
					<Button variant="default" onclick={oncopy}>Copy</Button>
					<Button variant="primary" onclick={ondownload}>Download world.ts</Button>
					<Button variant="ghost" onclick={onclose} class="close">×</Button>
				</div>
			</div>
			<div class="sheet-body">
				{@render children?.()}
			</div>
			{#if footer}
				<div class="sheet-foot">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		z-index: 1000;
		padding: var(--h-topbar);
	}

	.sheet-backdrop.preview {
		position: relative;
		inset: auto;
		width: 100%;
		height: 800px;
		background: var(--bg-0);
		border-radius: var(--r-lg);
		overflow: hidden;
		padding: var(--space-5);
	}

	.sheet {
		background: var(--bg-1);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-lg);
		width: 960px;
		max-width: 92vw;
		height: 720px;
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-modal);
		overflow: hidden;
		animation: sheet-in 0.2s var(--ease-quick);
	}

	@keyframes sheet-in {
		from {
			opacity: 0;
			transform: scale(0.98) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.sheet-head {
		padding: var(--space-4) var(--space-5);
		border-bottom: 1px solid var(--line);
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.sheet-head .title {
		color: var(--ink-0);
	}

	.sheet-head .meta {
		color: var(--ink-2);
	}

	.sheet-head .actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.sheet-body {
		flex: 1;
		min-height: 0;
		display: flex;
	}

	.sheet-foot {
		padding: var(--space-3) var(--space-5);
		background: var(--bg-2);
		border-top: 1px solid var(--line);
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}


</style>
