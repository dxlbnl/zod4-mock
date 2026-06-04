<script module lang="ts">
	// B100-R7 — <DefRef> concept tooltip / inline glossary.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: emits Pagefind concept meta; keyboard-reachable +
	// accessible name; DefRef story present).
	//
	// Accessibility: the element MUST be focusable (button or equivalent)
	// with an accessible name that includes the `term`.

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect, userEvent } from 'storybook/test';
	import DefRef from './DefRef.svelte';

	const { Story } = defineMeta({
		title: 'Docs/DefRef',
		component: DefRef,
		tags: ['autodocs']
	});
</script>

<Story
	name="B100-R7 / emits data-pagefind-meta and is keyboard-reachable"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// data-pagefind-meta="concept:determinism" on the rendered element.
		const tagged = canvasElement.querySelector('[data-pagefind-meta="concept:determinism"]');
		await expect(tagged).toBeInTheDocument();
		await expect((tagged?.textContent ?? '').includes('determinism')).toBe(true);

		// Keyboard-reachable: tab to it and verify accessible role + name.
		await userEvent.tab();
		const focused = document.activeElement as HTMLElement;
		// The role must be button (or equivalent). Default <button> is fine.
		const role = focused.getAttribute('role') ?? focused.tagName.toLowerCase();
		await expect(['button', 'BUTTON'].includes(role) || role === 'button').toBe(true);
		// Accessible name includes the term.
		const accName =
			focused.getAttribute('aria-label') ??
			focused.getAttribute('aria-labelledby') ??
			focused.textContent ??
			'';
		await expect(accName.includes('determinism')).toBe(true);
	}}
>
	<DefRef term="determinism">determinism</DefRef>
</Story>
