<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import WorldConfig from './WorldConfig.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'App/WorldConfig',
		component: WorldConfig,
		tags: ['autodocs'],
		args: {
			onupdateseed: fn(),
			onupdateprob: fn()
		}
	});
</script>

<Story name="Default" args={{
	seed: 42,
	optionalProbability: 0.5
}} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);

	// LR-1: Configure seed
	const seedInput = canvas.getByDisplayValue('42');
	await userEvent.clear(seedInput);
	await userEvent.type(seedInput, '123');
	expect(args.onupdateseed).toHaveBeenCalledWith(123);

	// LR-2: Configure optional probability
	const probInput = canvas.getByDisplayValue('0.5');
	await userEvent.clear(probInput);
	await userEvent.type(probInput, '0.8');
	expect(args.onupdateprob).toHaveBeenCalledWith(0.8);
}} />
