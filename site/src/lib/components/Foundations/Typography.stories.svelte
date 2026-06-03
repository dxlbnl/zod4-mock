<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';

	const { Story } = defineMeta({ title: 'Foundations/Typography', tags: ['autodocs'] });
</script>

<Story
	name="Scale"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('t-large — Benchmark Results')).toBeInTheDocument();
		await expect(canvas.getByText('t-mono — 42 000 ops/sec')).toBeInTheDocument();
		await expect(canvasElement.querySelector('.t-large')).toBeInTheDocument();
		await expect(canvasElement.querySelector('.t-mono')).toBeInTheDocument();
	}}
>
	<div style="display:flex;flex-direction:column;gap:16px;padding:24px">
		<p class="t-large">t-large — Benchmark Results</p>
		<p class="t-title">t-title — Library Comparison</p>
		<p class="t-base">t-base — zod4-mock generates referentially consistent mock data from Zod schemas.</p>
		<p class="t-small">t-small — Run the benchmark to compare ops/sec across libraries.</p>
		<p class="t-label">t-label — SCHEMA TYPE</p>
		<p class="t-caption">t-caption — Generated in 42ms using zod4-mock v0.2.3</p>
		<p class="t-micro">t-micro — performance</p>
		<p class="t-mono">t-mono — 42 000 ops/sec</p>
	</div>
</Story>
