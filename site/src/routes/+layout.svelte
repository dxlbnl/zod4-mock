<script lang="ts">
	import '$lib/styles/app.css';
	import { Container, Nav, Stack } from '@dxlbnl/ui';
	import DocsSearch from '$lib/docs/widgets/DocsSearch.svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const navLinks = [
		{ href: '/docs/getting-started', label: 'Docs' },
		{ href: '/explorer', label: 'Explorer' },
		{ href: '/showcase', label: 'Showcase' },
		{ href: '/comparison', label: 'Comparison' },
		{ href: '/bench', label: 'Bench' },
		{ href: 'https://github.com/dxlbnl/zod4-mock', label: 'GitHub' },
		{ href: 'https://www.npmjs.com/package/zod4-mock', label: 'npm' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="site-header">
	<Nav siteName="zod4-mock" links={navLinks} sticky={false} />
	<DocsSearch />
</div>
<Container size="lg">
	<Stack gap="lg">
		{@render children()}
	</Stack>
</Container>

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
	.site-header :global(nav) {
		flex: 1 1 auto;
	}
</style>
