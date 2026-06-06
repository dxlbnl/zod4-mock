<script lang="ts">
	import { Button } from '@dxlbnl/ui';

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
		<Button variant="ghost" class="copy-btn" onclick={copy} type="button">
			{copied ? 'Copied!' : 'Copy'}
		</Button>
	</div>
	<div class="code">{@html raw}</div>
</div>

<style>
	.block {
		position: relative;
		border: 1px solid var(--rule);
		border-radius: 8px;
		overflow: hidden;
		margin: 12px 0;
	}

	.toolbar {
		display: flex;
		justify-content: flex-end;
		padding: 4px var(--u);
		background: var(--bg);
		border-bottom: 1px solid var(--rule);
	}

	:global(.copy-btn) {
		font-size: 11px;
	}

	.code {
		overflow: auto;
	}

	.code :global(pre) {
		margin: 0;
		padding: var(--u2);
		background: transparent !important;
		font-family: var(--mono);
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
