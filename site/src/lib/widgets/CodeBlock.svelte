<script lang="ts">
	interface Props {
		raw: string;
		source: string;
	}

	let { raw, source }: Props = $props();

	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(source);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="block">
	<div class="toolbar">
		<button class="btn ghost copy-btn" onclick={copy} type="button">
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>
	<div class="code">{@html raw}</div>
</div>

<style>
	.block {
		position: relative;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		margin: var(--space-3) 0;
	}

	.toolbar {
		display: flex;
		justify-content: flex-end;
		padding: var(--space-1) var(--space-2);
		background: var(--bg-base);
		border-bottom: 1px solid var(--border);
	}

	.copy-btn {
		font-size: 11px;
		height: 22px;
		padding: 0 var(--space-2);
		color: var(--text-muted);
	}

	.copy-btn:hover {
		color: var(--text-primary);
	}

	.code {
		overflow: auto;
	}

	.code :global(pre) {
		margin: 0;
		padding: var(--space-4);
		background: transparent !important;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.6;
	}

	.code :global(code) {
		font-family: inherit;
		background: none;
		padding: 0;
		color: inherit;
		font-size: inherit;
	}
</style>
