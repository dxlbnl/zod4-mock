<script lang="ts">
	// B100-R3 — <SignatureBlock> TS signature card.
	// Renders a Card containing the TS signature (in a <code> element)
	// and a 1-2 line description. Optional inline <Playground> when
	// `playground` is provided.

	import { Card } from '@dxlbnl/ui';
	import Playground from './Playground.svelte';

	interface Props {
		signature: string;
		description: string;
		playground?: { initialCode: string };
	}

	let { signature, description, playground }: Props = $props();
</script>

<Card>
	<div class="sig-block">
		<pre class="sig"><code>{signature}</code></pre>
		<p class="desc">{description}</p>
		{#if playground}
			<div class="inline-pg">
				<Playground initialCode={playground.initialCode} />
			</div>
		{/if}
	</div>
</Card>

<style>
	.sig-block {
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.sig {
		margin: 0;
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink);
		background: var(--bg-rail);
		padding: var(--space-3);
		border-radius: 6px;
		border: 1px solid var(--rule);
		overflow-x: auto;
	}
	.sig code {
		background: none;
		color: inherit;
		font-family: inherit;
		padding: 0;
	}
	.desc {
		color: var(--ink-dim);
		font-size: 13px;
		line-height: 1.6;
	}
</style>
