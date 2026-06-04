<script module lang="ts">
	// B100-R2 — <Playground> rebadge of SchemaPlayground.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenario: re-exports SchemaPlayground behavior; story present).
	//
	// SSR-safety (B100-R2 scenario 2) is verified by `pnpm site:build`
	// completing without `window is not defined` — that's the
	// implementer's build-time signal, asserted on the acceptance list,
	// not encoded as a runtime play().
	//
	// Red until site/src/lib/docs/widgets/Playground.svelte exists and
	// re-exports the SchemaPlayground contract.

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect, userEvent } from 'storybook/test';
	import Playground from './Playground.svelte';

	const { Story } = defineMeta({
		title: 'Docs/Playground',
		component: Playground,
		tags: ['autodocs']
	});
</script>

<Story
	name="B100-R2 / re-exports SchemaPlayground behavior"
	args={{ initialCode: 'z.string().email()' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvasElement.querySelector('.cm-editor')).toBeInTheDocument();
		await userEvent.click(canvas.getByRole('button', { name: /randomize/i }));
		await expect(canvasElement.querySelector('.output')).toBeInTheDocument();
	}}
/>
