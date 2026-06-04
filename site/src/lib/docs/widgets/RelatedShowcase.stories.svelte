<script module lang="ts">
	// B100-R8 — <RelatedShowcase> embed a /showcase slice inline.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: renders the entity slice + link; RelatedShowcase
	// story present).

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import RelatedShowcase from './RelatedShowcase.svelte';

	const { Story } = defineMeta({
		title: 'Docs/RelatedShowcase',
		component: RelatedShowcase,
		tags: ['autodocs']
	});
</script>

<Story
	name="B100-R8 / renders the entity slice + link"
	args={{ entity: 'review' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// A JSON-tree slice is rendered (existing JsonTree widget uses .json-tree).
		await expect(canvasElement.querySelector('.json-tree')).toBeInTheDocument();

		// "see the full demo →" link points at /showcase#review.
		const demoLink = canvas.getByRole('link', { name: /see the full demo/i });
		await expect(demoLink.getAttribute('href')).toBe('/showcase#review');
	}}
/>
