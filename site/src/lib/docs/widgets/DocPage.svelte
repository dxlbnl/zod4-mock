<script lang="ts">
	// B100-R1 — <DocPage> page shell.
	// Wraps content in @dxlbnl/ui Container + Stack + Prose, renders the
	// title as an <h1>, exposes an "On this page" right rail derived from
	// <h2> headings, and emits the prose container with data-pagefind-body
	// for B104 search indexing.

	import { onMount, type Snippet } from 'svelte';
	import { Container, Stack, Prose, Heading } from '@dxlbnl/ui';
	import type { SidebarGroupId } from '../sidebar.js';
	import { slugify } from '../slug.js';

	type PrereqPage = { href: string; label: string };

	interface Props {
		title: string;
		sidebarGroup: SidebarGroupId;
		order: number;
		prerequisites?: ReadonlyArray<string | PrereqPage>;
		related?: ReadonlyArray<string>;
		editPath?: string;
		// B125: opt-in 2-level "On this page" rail — harvest <h2> symbols AND their
		// <h3> members, nesting the member links under their symbol. Off by default so
		// narrative pages keep their flat h2-only rail exactly as before.
		memberToc?: boolean;
		children?: Snippet;
	}

	let {
		title,
		prerequisites = [],
		related = [],
		editPath,
		memberToc = false,
		children
	}: Props = $props();

	// On-this-page rail — derived from headings after mount.
	// B123: group <h2>s (the `api-group` headings emitted by /docs/api) are flagged
	// so the rail can mark them distinctly from per-symbol headings and nest the
	// symbol links under their group.
	// B125: when `memberToc` is on, each symbol <h2> is a (linked) parent row and
	// each member <h3> is a nested child row under the preceding symbol, reusing the
	// B123 group/nest treatment. `group: true` flags a parent/symbol row.
	type Anchor = { id: string; text: string; group: boolean };
	let anchors: Anchor[] = $state([]);
	// True when this page has parent/group rows (api-group <h2> on narrative-grouped
	// pages, or the member-toc symbol rows on /docs/api). Plain narrative pages have
	// neither, so the rail stays a flat list exactly as before.
	const hasGroups = $derived(anchors.some((a) => a.group));
	// eslint-disable-next-line no-unassigned-vars -- assigned by bind:this
	let proseEl: HTMLElement;

	onMount(() => {
		// Only consider headings belonging to *this* DocPage's prose container —
		// if a nested <DocPage> appears inside our slot (e.g. when the
		// storybook-svelte-csf auto-wrapper renders us around the test's
		// own <DocPage>), its headings belong to the inner page's rail, not ours.
		const owns = (h: Element) => h.closest('[data-pagefind-body]') === proseEl;
		const selector = memberToc ? 'h2, h3' : 'h2';
		const heads = Array.from(proseEl.querySelectorAll(selector)).filter(owns);
		anchors = heads.map((h) => {
			const text = (h.textContent ?? '').trim();
			const id = h.id || slugify(text);
			if (!h.id) h.id = id;
			// In member-toc mode a symbol <h2> is the parent (group) row and its
			// member <h3>s nest beneath it. Otherwise the B123 api-group flag drives
			// grouping (and h3s are never harvested).
			const group = memberToc ? h.tagName === 'H2' : h.classList.contains('api-group');
			return { id, text, group };
		});
	});

	const editHref = $derived(
		editPath ? `https://github.com/dxlbnl/zod4-mock/edit/main/${editPath}` : null
	);

	// B114-R1/R3: below 1024 the "On this page" rail is a collapsed <details>
	// disclosure below the content (mobile and tablet both keep it collapsed so
	// the prose track has room); at ≥1024 it becomes the normal sticky right rail
	// (the three-column desktop reflow). A closed <details> drops its links from
	// the accessibility tree even when CSS shows them, so at ≥1024 the disclosure
	// must be genuinely `open` (keeps the B102 docs-api TOC links role-exposed).
	// Track the viewport and reflect it into the `open` attribute; default open
	// (SSR / pre-mount) so server HTML exposes the links, then collapse below 1024
	// after mount.
	let tocOpen = $state(true);
	onMount(() => {
		const mq = window.matchMedia('(max-width: 1023px)');
		const sync = () => {
			tocOpen = !mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});
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
			<Prose maxWidth="720px">
				<div bind:this={proseEl} data-pagefind-body class="doc-prose-body">
					{#if children}{@render children()}{/if}
				</div>
			</Prose>
			<!-- B114-R1 (mobile + tablet, <1024): the "On this page" rail moves below
			     the prose and becomes a collapsed <details> disclosure; at desktop
			     (≥1024) the <details> is transparent and the <aside> is the sticky
			     right column with its <summary> hidden. -->
			<aside class="on-this-page" aria-label="On this page" data-pagefind-ignore>
				{#if anchors.length > 0}
					<details class="toc-disclosure" open={tocOpen}>
						<summary>On this page</summary>
						<ul class:grouped={hasGroups}>
							{#each anchors as a}
								{#if a.group}
									{#if memberToc}
										<!-- B125: in member-toc mode the parent/symbol row is a real link
										     to its anchor while still reading as a group header. -->
										<li data-toc-group class="toc-group rail-heading">
											<a href="#{a.id}">{a.text}</a>
										</li>
									{:else}
										<!-- B123: group heading row — distinct (not a link), reusing the
										     rail-heading uppercase/dim treatment, marked for the rail. -->
										<li data-toc-group class="toc-group rail-heading">{a.text}</li>
									{/if}
								{:else}
									<li class="toc-symbol"><a href="#{a.id}">{a.text}</a></li>
								{/if}
							{/each}
						</ul>
					</details>
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
		/* B114: below 1024 (mobile + tablet) the TOC is a collapsed <details> below
		   the prose, so the grid is a single content column — at 768 the layout
		   already spends horizontal space on the section sidebar, and a second
		   200px rail here would crush the prose track to ~165px. The right TOC rail
		   only returns as a column at ≥1024 (see the @media (min-width: 1024px)
		   block). minmax(0, 1fr) — not 1fr — so a wide table/code block can shrink
		   and scroll inside its own container rather than widen the page (B114-R6). */
		grid-template-columns: minmax(0, 1fr);
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
	/* B114-R3 (desktop ≥1024): the right TOC rail returns as a column. The grid
	   takes a 200px track and the TOC disclosure goes transparent — its links are
	   always shown and the <summary> hidden, so the rail reads as a normal sticky
	   right column rather than a collapsed details. */
	@media (min-width: 1024px) {
		.doc-grid {
			/* minmax(0, 1fr) — not 1fr — so the content column can shrink below its
			   min-content width; otherwise a wide signature/table/code block grows
			   the track and pushes the "On this page" rail off-screen (B102). */
			grid-template-columns: minmax(0, 1fr) 200px;
		}
		.toc-disclosure > summary {
			display: none;
		}
		.toc-disclosure > ul {
			/* force the list visible regardless of the (unset) `open` state */
			display: flex;
		}
		/* B114-R5: keep every TOC entry on a single line — a long heading
		   ("Step 1 — Generate without any setup") truncates with an ellipsis in
		   the rail rather than wrapping to a second line. */
		.toc-disclosure a {
			display: block;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
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
	/* B123: group rows in the "On this page" TOC read as headings (reusing the
	   rail-heading uppercase/dim treatment), and per-symbol rows nest one level
	   under their group label. Only /docs/api emits api-group headings, so on
	   narrative docs pages there are no `.toc-group` rows and nothing indents. */
	.on-this-page .toc-group {
		margin-bottom: 0;
		margin-top: var(--u);
	}
	.on-this-page .toc-group:first-child {
		margin-top: 0;
	}
	.on-this-page .grouped .toc-symbol {
		padding-left: var(--u2);
	}
	/* B125: in member-toc mode the symbol/parent row is a link that still reads as a
	   group header — inherit the rail-heading uppercase/dim treatment for the anchor
	   and only brighten on hover. */
	.on-this-page .toc-group a {
		color: var(--ink-faint, var(--ink-dim));
		text-decoration: none;
	}
	.on-this-page .toc-group a:hover {
		color: var(--amber);
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
	/* B114-R1 (mobile + tablet, ≤1023): the grid is a single content column and
	   the TOC stacks below as a collapsed <details> with a visible <summary>. The
	   right TOC rail only returns at ≥1024 (above), so at 768 the prose has room
	   beside the section sidebar without a second rail crushing it. */
	@media (max-width: 1023px) {
		.on-this-page {
			position: static;
			font-size: 13px;
		}
		.toc-disclosure {
			border: 1px solid var(--rule);
			border-radius: 8px;
			background: var(--bg-rail);
		}
		.toc-disclosure > summary {
			cursor: pointer;
			padding: var(--u) 12px;
			font-weight: 500;
			color: var(--ink);
			list-style: none;
		}
		.toc-disclosure > summary::-webkit-details-marker {
			display: none;
		}
		.toc-disclosure > summary::before {
			content: "▸ ";
			color: var(--ink-dim);
		}
		.toc-disclosure[open] > summary::before {
			content: "▾ ";
		}
		.toc-disclosure > ul {
			padding: 0 12px var(--u);
		}
	}
</style>
