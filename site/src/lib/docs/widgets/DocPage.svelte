<script lang="ts">
	// B100-R1 — <DocPage> page shell.
	// Wraps content in @dxlbnl/ui Container + Stack + Prose, renders the
	// title as an <h1>, exposes an "On this page" right rail derived from
	// <h2> headings, and emits the prose container with data-pagefind-body
	// for B104 search indexing.

	import { onMount, type Snippet } from 'svelte';
	import { Container, Stack, Prose, Heading } from '@dxlbnl/ui';
	import type { SidebarGroupId } from '../sidebar.js';

	type PrereqPage = { href: string; label: string };

	interface Props {
		title: string;
		sidebarGroup: SidebarGroupId;
		order: number;
		prerequisites?: ReadonlyArray<string | PrereqPage>;
		related?: ReadonlyArray<string>;
		editPath?: string;
		children?: Snippet;
	}

	let { title, prerequisites = [], related = [], editPath, children }: Props = $props();

	// On-this-page rail — derived from <h2> headings after mount.
	type Anchor = { id: string; text: string };
	let anchors: Anchor[] = $state([]);
	// eslint-disable-next-line no-unassigned-vars -- assigned by bind:this
	let proseEl: HTMLElement;

	onMount(() => {
		// Only consider h2s belonging to *this* DocPage's prose container —
		// if a nested <DocPage> appears inside our slot (e.g. when the
		// storybook-svelte-csf auto-wrapper renders us around the test's
		// own <DocPage>), its h2s belong to the inner page's rail, not ours.
		const heads = Array.from(proseEl.querySelectorAll('h2')).filter((h) => {
			const owner = h.closest('[data-pagefind-body]');
			return owner === proseEl;
		});
		anchors = heads.map((h) => {
			const text = (h.textContent ?? '').trim();
			const id = h.id || text.toLowerCase().replace(/\s+/g, '-');
			if (!h.id) h.id = id;
			return { id, text };
		});
	});

	const editHref = $derived(
		editPath ? `https://github.com/dxlbnl/zod4-mock/edit/main/${editPath}` : null
	);
</script>

<Container size="lg">
	<Stack gap="lg">
		<Heading level={1} variant="h1">{title}</Heading>

		{#if prerequisites.length > 0}
			<div class="prereqs">
				{#each prerequisites as p}
					{#if typeof p === 'string'}
						<a href={p}>{p}</a>
					{:else}
						<a href={p.href}>{p.label}</a>
					{/if}
				{/each}
			</div>
		{/if}

		<div class="doc-grid">
			<Prose>
				<div bind:this={proseEl} data-pagefind-body class="doc-prose-body">
					{#if children}{@render children()}{/if}
				</div>
			</Prose>
			<aside class="on-this-page" aria-label="On this page" data-pagefind-ignore>
				{#if anchors.length > 0}
					<p class="rail-heading">On this page</p>
					<ul>
						{#each anchors as a}
							<li><a href="#{a.id}">{a.text}</a></li>
						{/each}
					</ul>
				{/if}
			</aside>
		</div>

		{#if related.length > 0}
			<div class="related">
				<p class="rail-heading">Related</p>
				<ul>
					{#each related as href}
						<li><a {href}>{href}</a></li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if editHref}
			<p class="edit-link">
				<a href={editHref} target="_blank" rel="noopener">Edit on GitHub</a>
			</p>
		{/if}
	</Stack>
</Container>

<style>
	.doc-grid {
		display: grid;
		/* minmax(0, 1fr) — not 1fr — so the content column can shrink below its
		   min-content width; otherwise a wide signature/table/code block grows
		   the track and pushes the "On this page" rail off-screen (B102). */
		grid-template-columns: minmax(0, 1fr) 200px;
		gap: var(--u3);
		align-items: start;
	}
	.doc-prose-body {
		min-width: 0;
	}
	.on-this-page {
		position: sticky;
		top: var(--u3);
		font-size: 12px;
	}
	.on-this-page ul,
	.related ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.on-this-page a,
	.related a {
		color: var(--ink-dim);
		text-decoration: none;
	}
	.on-this-page a:hover,
	.related a:hover {
		color: var(--amber);
	}
	.rail-heading {
		font-size: 11px;
		color: var(--ink-faint, var(--ink-dim));
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: var(--u);
	}
	.prereqs {
		display: flex;
		gap: 12px;
		font-size: 12px;
	}
	.edit-link a {
		color: var(--ink-dim);
		font-size: 12px;
		text-decoration: none;
	}
	.edit-link a:hover {
		color: var(--amber);
	}
	@media (max-width: 720px) {
		.doc-grid {
			grid-template-columns: 1fr;
		}
		.on-this-page {
			position: static;
		}
	}
</style>
