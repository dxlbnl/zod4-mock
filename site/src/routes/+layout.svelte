<script lang="ts">
	import '$lib/styles/app.css';
	import { Container, Nav, Stack } from '@dxlbnl/ui';
	import DocsSearch from '$lib/docs/widgets/DocsSearch.svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// B117: GitHub + npm are external/utility links — rendered as icon links in the
	// header region (right of <Nav>, like DocsSearch) rather than as textual nav items.
	// @dxlbnl/ui ships no icon component, so the marks are inline SVG.
	const navLinks = [
		{ href: '/docs/getting-started', label: 'Docs' },
		{ href: '/explorer', label: 'Explorer' },
		{ href: '/showcase', label: 'Showcase' },
		{ href: '/comparison', label: 'Comparison' },
		{ href: '/bench', label: 'Bench' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="site-header">
	<Nav siteName="zod4-mock" links={navLinks} sticky={false} />
	<div class="header-tools">
		<DocsSearch />
		<nav class="icon-links" aria-label="External links">
			<a
				class="icon-link"
				href="https://github.com/dxlbnl/zod4-mock"
				aria-label="GitHub"
				target="_blank"
				rel="noopener"
			>
				<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
					<path
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
					/>
				</svg>
			</a>
			<a
				class="icon-link"
				href="https://www.npmjs.com/package/zod4-mock"
				aria-label="npm"
				target="_blank"
				rel="noopener"
			>
				<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
					<path d="M0 0v16h16V0H0zm13 13h-2V5H8v8H3V3h10v10z" />
				</svg>
			</a>
		</nav>
	</div>
</div>
<main class="page-shell">
	<Container size="lg">
		<Stack gap="lg">
			{@render children()}
		</Stack>
	</Container>
</main>

<style>
	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--u2, 16px);
		/* Right gutter so the Search trigger isn't pinned to / clipped at the
		   viewport edge (B104 designer pass). Keeps <Nav> + trigger on one row. */
		padding-right: var(--u3, 24px);
	}
	/* Only the <Nav> (the direct-child <nav>) grows to fill the bar; the icon-links
	   <nav> in .header-tools must stay intrinsic-width (B117). */
	.site-header > :global(nav) {
		flex: 1 1 auto;
	}
	.header-tools {
		display: flex;
		align-items: center;
		gap: var(--u2, 16px);
		flex: 0 0 auto;
	}
	/* B117: GitHub + npm utility icon links, set apart from the textual nav. */
	.icon-links {
		display: flex;
		align-items: center;
		gap: var(--u, 8px);
	}
	.icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-dim);
		transition: color var(--transition, 0.15s ease);
	}
	.icon-link:hover {
		color: var(--amber);
	}
</style>
