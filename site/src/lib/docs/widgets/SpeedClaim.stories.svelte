<script module lang="ts">
	// B100-R6 — <SpeedClaim> honest-framing primitive (D17/D20).
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: rendered value + citation; SpeedClaim story present).
	//
	// The compile-time "TypeScript rejects a missing `source` prop"
	// scenario lives in SpeedClaim.types.test.ts and is run by
	// `pnpm site:check`, not here.

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import SpeedClaim from './SpeedClaim.svelte';

	const { Story } = defineMeta({
		title: 'Docs/SpeedClaim',
		component: SpeedClaim,
		tags: ['autodocs']
	});
</script>

<Story
	name="B100-R6 / rendered value + visible citation"
	args={{
		tier: 'user',
		value: '2.7×',
		vs: '@anatine/zod-mock',
		source: 'site/bench/results/latest.json'
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Headline value, "vs" label, and visible citation line (D17/D20).
		await expect(canvas.getByText('2.7×')).toBeInTheDocument();
		await expect(canvas.getByText('@anatine/zod-mock')).toBeInTheDocument();
		await expect(canvas.getByText('site/bench/results/latest.json')).toBeInTheDocument();
	}}
/>
