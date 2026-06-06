<script lang="ts">
	// B100-R9 — <Prerequisites> "what you need to have read" callout.
	// Renders as a @dxlbnl/ui Alert (info variant). When `pages` is empty,
	// MUST NOT render any DOM (the alert is suppressed).

	import { Alert } from '@dxlbnl/ui';

	type PrereqPage = { href: string; label: string };

	interface Props {
		pages: ReadonlyArray<PrereqPage>;
	}

	let { pages }: Props = $props();
</script>

{#if pages.length > 0}
	<Alert variant="info" title="Before you read this">
		<ul class="prereq-list">
			{#each pages as p}
				<li><a href={p.href}>{p.label}</a></li>
			{/each}
		</ul>
	</Alert>
{/if}

<style>
	.prereq-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.prereq-list a {
		color: var(--amber);
		text-decoration: none;
		font-size: 13px;
	}
	.prereq-list a:hover {
		text-decoration: underline;
	}
</style>
