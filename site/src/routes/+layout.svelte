<script lang="ts">
	import '$lib/styles/app.css';
	import { Container, Nav, Stack } from '@dxlbnl/ui';
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

<Nav siteName="zod4-mock" links={navLinks} sticky={false} />
<Container size="lg">
	<Stack gap="lg">
		{@render children()}
	</Stack>
</Container>
