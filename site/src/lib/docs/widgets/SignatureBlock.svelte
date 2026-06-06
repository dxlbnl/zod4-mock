<script lang="ts">
	// B100-R3 — <SignatureBlock> TS signature card.
	// Renders a Card containing the TS signature (in a <code> element)
	// and a 1-2 line description. Optional inline <Playground> when
	// `playground` is provided.

	import { Card } from '@dxlbnl/ui';
	import Playground from './Playground.svelte';
	import { renderInline } from './inline.js';

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
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped in renderInline -->
		<p class="desc">{@html renderInline(description)}</p>
		{#if playground}
			<div class="inline-pg">
				<Playground initialCode={playground.initialCode} />
			</div>
		{/if}
	</div>
</Card>

<style>
	.sig-block {
		padding: var(--u2);
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* Allow the flex column to shrink below the signature's intrinsic
		   width so the <pre> below can clip+scroll instead of stretching the
		   page (B102 horizontal-overflow blocker). */
		min-width: 0;
	}
	.sig {
		margin: 0;
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink);
		background: var(--bg-rail);
		padding: 12px;
		border-radius: 6px;
		border: 1px solid var(--rule);
		overflow-x: auto;
		/* A flex item won't shrink below its content's intrinsic width
		   without this; required for overflow-x:auto to actually clip. */
		min-width: 0;
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
