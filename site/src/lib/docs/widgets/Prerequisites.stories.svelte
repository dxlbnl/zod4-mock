<script module lang="ts">
	// B100-R9 — <Prerequisites> "what you need to have read" callout.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: renders one link per page; empty pages suppresses
	// the alert; Prerequisites story present).

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import Prerequisites from './Prerequisites.svelte';

	const { Story } = defineMeta({
		title: 'Docs/Prerequisites',
		component: Prerequisites,
		tags: ['autodocs']
	});

	const pages = [
		{ href: '/docs/concepts', label: 'Concepts' },
		{ href: '/docs/getting-started', label: 'Getting Started' }
	] as const;
</script>

<Story
	name="B100-R9 / renders one link per page with accessible names"
	args={{ pages }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const concepts = canvas.getByRole('link', { name: 'Concepts' });
		await expect(concepts.getAttribute('href')).toBe('/docs/concepts');
		const gs = canvas.getByRole('link', { name: 'Getting Started' });
		await expect(gs.getAttribute('href')).toBe('/docs/getting-started');
	}}
/>

<Story
	name="B100-R9 / empty pages suppresses the alert"
	args={{ pages: [] }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// No alert / status / note role surfaces.
		await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('note')).not.toBeInTheDocument();
		// No prerequisite-link text either.
		await expect(canvas.queryByRole('link', { name: 'Concepts' })).not.toBeInTheDocument();
	}}
/>
