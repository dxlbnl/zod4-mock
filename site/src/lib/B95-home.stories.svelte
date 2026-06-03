<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import Page from '../routes/+page.svelte';

	// B95-R5 / Replace the / hero with PageHero + CtaBlock + Button.
	//
	// After migration, +page.svelte composes the hero from @dxlbnl/ui
	// primitives, keeps the honest framing copy ("Schema-driven mocks"
	// per D20 — no "fastest" / "faster than the alternatives"), exposes
	// a primary CTA "Install" linking to /docs/getting-started and a
	// secondary CTA linking to /showcase, and keeps the inline
	// relational exhibit (JsonTree-backed) below the hero.

	const { Story } = defineMeta({
		title: 'B95/Home',
		component: Page,
		tags: ['!autodocs']
	});
</script>

<Story
	name="B95-R5 hero composition + relational exhibit"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Honest framing — heading mentions "Schema-driven mocks" and the page
		// must not contain "fastest" / "faster than the alternatives" anywhere.
		const heading = canvas.getByRole('heading', { name: /Schema-driven mocks/i, level: 1 });
		await expect(heading).toBeInTheDocument();

		const pageText = canvasElement.textContent ?? '';
		await expect(/fastest/i.test(pageText), 'page copy must not say "fastest" (D20)').toBe(false);
		await expect(
			/faster than the alternatives/i.test(pageText),
			'page copy must not say "faster than the alternatives" (D20)'
		).toBe(false);

		// Primary CTA: Install → /docs/getting-started. Secondary CTA: → /showcase.
		const install = canvas.getByRole('link', { name: /^Install$/ });
		await expect(install.getAttribute('href')).toBe('/docs/getting-started');

		const showcaseLinks = Array.from(canvasElement.querySelectorAll('a')).filter(
			(a) => a.getAttribute('href') === '/showcase'
		);
		await expect(showcaseLinks.length, 'expected at least one secondary CTA linking to /showcase').toBeGreaterThan(0);

		// Inline relational exhibit still renders: a "Review (generated)" label
		// and at least one proof row.
		await expect(canvas.getByText(/Review \(generated\)/i)).toBeInTheDocument();
		const proofRows = canvasElement.querySelectorAll('.proof-row');
		await expect(proofRows.length, 'expected at least one proof row in the relational exhibit').toBeGreaterThan(0);
	}}
/>
