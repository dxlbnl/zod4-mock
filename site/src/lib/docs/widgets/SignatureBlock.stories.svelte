<script module lang="ts">
	// B100-R3 — <SignatureBlock> TS signature card.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: signature + description render; inline playground
	// when provided; SignatureBlock story present).

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import SignatureBlock from './SignatureBlock.svelte';

	const { Story } = defineMeta({
		title: 'Docs/SignatureBlock',
		component: SignatureBlock,
		tags: ['autodocs']
	});
</script>

<Story
	name="B100-R3 / signature + description render"
	args={{
		signature: 'generate(schema: ZodType): unknown',
		description: 'Zero-config entry point.'
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Signature lives inside a <code> element.
		const codeEls = Array.from(canvasElement.querySelectorAll('code'));
		const hasSignature = codeEls.some((el) =>
			(el.textContent ?? '').includes('generate(schema: ZodType): unknown')
		);
		await expect(
			hasSignature,
			'signature text must render inside a <code> element'
		).toBe(true);

		// Description is in the document.
		await expect(canvas.getByText(/Zero-config entry point\./)).toBeInTheDocument();
	}}
/>

<Story
	name="B100-R3 / inline playground when provided"
	args={{
		signature: 'generate(schema: ZodType): unknown',
		description: 'Zero-config entry point.',
		playground: { initialCode: 'z.string()' }
	}}
	play={async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('.cm-editor')).toBeInTheDocument();
	}}
/>
