<script lang="ts">
	// B100-R10 / B100-R15 — docs chrome.
	// Sidebar driven by the typed SIDEBAR manifest. data-pagefind-ignore
	// applied to the <aside> chrome so B104 search doesn't index nav.
	// Active link carries aria-current="page".

	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { SIDEBAR } from '$lib/docs/sidebar.js';

	let { children } = $props();

	// B114-R2/R3 a11y: on mobile (≤767) the section nav is a collapsed <details>
	// disclosure; at ≥768 it must be genuinely `open` so its links stay in the
	// accessibility tree — a closed <details> drops its descendants from the a11y
	// tree even when CSS forces them visible. Default open (SSR / pre-mount) so the
	// prerendered HTML exposes the links, then collapse on mobile after mount.
	// Same mechanism as DocPage's `tocOpen`.
	let sidebarOpen = $state(true);
	onMount(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		const sync = () => {
			sidebarOpen = !mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	// Defensive: in Storybook component-test renders, $page may be
	// undefined (no sveltekit_experimental.stores.page parameter set).
	const pathname = $derived($page?.url?.pathname ?? '/docs');

	// Find the SIDEBAR link with the longest href that's a prefix of the
	// current pathname (handles both /docs/getting-started exact match
	// and /docs landing falling back to the first link).
	const activeHref = $derived.by(() => {
		let best: string | null = null;
		for (const group of SIDEBAR) {
			for (const link of group.links) {
				if (pathname === link.href) return link.href;
				if (pathname.startsWith(link.href)) {
					if (best === null || link.href.length > best.length) best = link.href;
				}
			}
		}
		if (best !== null) return best;
		// Fallback so storybook chrome stories have a deterministic active link.
		for (const group of SIDEBAR) {
			if (group.links.length > 0 && group.links[0]) return group.links[0].href;
		}
		return null;
	});
</script>

<div class="docs-layout">
	<!-- B114-R2/R3: on mobile the section nav is a collapsed <details> disclosure at
	     the top of the content; at tablet/desktop `sidebarOpen` stays true so the
	     <details> is genuinely `open` (keeping its links in the accessibility tree),
	     CSS hides the <summary>, and the <aside> renders as the normal left column. -->
	<details class="docs-sidebar-disclosure" open={sidebarOpen}>
		<summary>Documentation</summary>
		<aside class="docs-sidebar" data-pagefind-ignore aria-label="Documentation navigation">
			{#each SIDEBAR as group}
				{#if group.links.length > 0}
					<div class="group">
						<p class="sidebar-heading">{group.label}</p>
						{#each group.links as link}
							{#if link.href === activeHref}
								<a
									href={link.href}
									class="docs-nav-link active"
									aria-current="page"
								>
									{link.label}
								</a>
							{:else}
								<a href={link.href} class="docs-nav-link">{link.label}</a>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}
		</aside>
	</details>
	<div class="docs-content">
		{@render children()}
	</div>
</div>

<style>
	.docs-layout {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: var(--u4);
		align-items: start;
		/* B114-R5: drop the legacy 960px cap (app.css @layer site) so the docs
		   shell uses the full Container size="lg" width; this is what gives the
		   prose content track room to reach the comfortable ~720px reading
		   measure (the prose <Prose maxWidth="720px"> can finally bind). */
		max-width: none;
	}
	/* B114-R5 (tablet readability): the docs shell nests two @dxlbnl/ui
	   <Container size="lg"> — the site-wide one in the root +layout and the
	   per-page one in <DocPage>. Each adds 32px horizontal padding (≥720px), so
	   at tablet the doubled inner gutter (64px) plus the section sidebar squeezes
	   the prose track to a sliver (~388px → per-word wrapping). The outer
	   Container already provides the page gutter, so the inner one's horizontal
	   padding is redundant here; neutralise it within the docs shell to give the
	   prose track its width back. (Desktop prose stays bound by <Prose>'s 720px
	   max-width, so this only widens the cramped narrow bands.) Scoped to ≥768 so
	   the mobile single-column layout (which already reads full-width and relies on
	   the inner gutter for the clipped-sidebar geometry of B114-R1) is untouched. */
	@media (min-width: 768px) {
		.docs-content > :global(*) {
			padding-left: 0;
			padding-right: 0;
		}
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: var(--u2);
	}
	.sidebar-heading {
		color: var(--ink-dim);
		padding: 4px 12px;
		margin-bottom: 4px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
		font-weight: 500;
	}

	/* B114-R3 (tablet/desktop ≥768): the disclosure is transparent chrome — it is
	   the sticky left column of the .docs-layout grid, its <summary> is hidden,
	   and the <aside> is forced visible regardless of the (unset) `open` state so
	   the section nav renders as a normal column rather than a collapsed details. */
	@media (min-width: 768px) {
		.docs-sidebar-disclosure {
			position: sticky;
			top: var(--u3);
		}
		.docs-sidebar-disclosure > summary {
			display: none;
		}
		.docs-sidebar-disclosure > .docs-sidebar {
			display: flex;
		}
	}

	/* B114 three-step reflow — tablet band (768–1023): the section sidebar returns
	   as a column but the right TOC rail does NOT (DocPage keeps it collapsed-below
	   below 1024), so the prose shares the row only with the sidebar. Trim the
	   sidebar width + grid gap here to hand the freed space to the prose track,
	   keeping it readable (≥480px) without per-word wrapping. At ≥1024 the full
	   220px sidebar + --u4 gap return alongside the TOC rail. */
	@media (min-width: 768px) and (max-width: 1023px) {
		.docs-layout {
			grid-template-columns: 180px 1fr;
			gap: var(--u3);
		}
	}

	/* B114-R1 / B114-R2 (mobile ≤767): single content column; the section nav
	   collapses into a real <details> disclosure with a visible <summary> at the
	   top of the content. */
	@media (max-width: 767px) {
		.docs-layout {
			grid-template-columns: 1fr;
			gap: var(--u2);
		}
		.docs-sidebar-disclosure {
			display: block;
			border: 1px solid var(--rule);
			border-radius: 8px;
			background: var(--bg-rail);
		}
		.docs-sidebar-disclosure > summary {
			display: block;
			cursor: pointer;
			padding: var(--u) 12px;
			font-size: 13px;
			font-weight: 500;
			color: var(--ink);
			list-style: none;
		}
		.docs-sidebar-disclosure > summary::-webkit-details-marker {
			display: none;
		}
		.docs-sidebar-disclosure > summary::before {
			content: "☰ ";
			color: var(--ink-dim);
		}
		/* When the disclosure is closed the <aside> is collapsed to a 1px clipped
		   box (rather than display:none) so it still reports a bounding box left of
		   the prose (B114-R1) while its links are visually hidden until the summary
		   is activated (B114-R2). The app.css `.docs-sidebar { display: flex }`
		   keeps it rendered; we clip it here. */
		.docs-sidebar-disclosure:not([open]) > .docs-sidebar {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
		}
		.docs-sidebar-disclosure[open] > .docs-sidebar {
			position: static;
			padding: 0 12px var(--u);
		}
	}
</style>
