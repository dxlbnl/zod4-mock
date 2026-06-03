<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import Layout from '../routes/+layout.svelte';

	// B95-R4 / Replace layout chrome with @dxlbnl/ui Nav + Container + Stack.
	//
	// After the migration, +layout.svelte must render the new top-bar
	// with: brand wordmark "zod4-mock" (linking to /), then the labels
	// Docs / Explorer / Showcase / Comparison / Bench, and right-aligned
	// GitHub + npm links. /table must NOT appear anywhere in the nav.

	const { Story } = defineMeta({
		title: 'B95/Layout',
		component: Layout,
		tags: ['!autodocs']
	});

	const expectedOrder = ['zod4-mock', 'Docs', 'Explorer', 'Showcase', 'Comparison', 'Bench', 'GitHub', 'npm'];
</script>

{#snippet emptyChildren()}
	<span data-testid="layout-children-slot">page</span>
{/snippet}

<Story
	name="B95-R4 nav order + brand + no /table link"
	args={{ children: emptyChildren }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Brand wordmark — must read "zod4-mock" and link to /.
		const brand = canvas.getByRole('link', { name: /^zod4-mock$/ });
		await expect(brand).toBeInTheDocument();
		await expect(brand.getAttribute('href')).toBe('/');

		// Top-bar labels appear in the declared left-to-right order.
		const observedLinks: string[] = [];
		const allLinks = canvasElement.querySelectorAll('a');
		for (const a of Array.from(allLinks)) {
			const text = (a.textContent ?? '').trim();
			if (text) observedLinks.push(text);
		}
		const filtered = observedLinks.filter((label) => expectedOrder.includes(label));
		// Deduplicate while preserving first occurrence.
		const seen = new Set<string>();
		const dedup: string[] = [];
		for (const label of filtered) {
			if (!seen.has(label)) {
				seen.add(label);
				dedup.push(label);
			}
		}
		await expect(dedup).toEqual(expectedOrder);

		// /table link MUST NOT exist.
		const tableLink = canvasElement.querySelector('a[href="/table"], a[href^="/table/"]');
		await expect(tableLink).toBeNull();

		// GitHub link points to the canonical repo URL; npm to the canonical package URL.
		const github = canvas.getByRole('link', { name: /GitHub/ });
		await expect(github.getAttribute('href')).toBe('https://github.com/dxlbnl/zod4-mock');
		const npm = canvas.getByRole('link', { name: /^npm$/ });
		await expect(npm.getAttribute('href')).toBe('https://www.npmjs.com/package/zod4-mock');
	}}
/>
