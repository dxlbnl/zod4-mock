<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';

	const { Story } = defineMeta({ title: 'Foundations/Color', tags: ['autodocs'] });
</script>

<Story
	name="Palette"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Accent')).toBeInTheDocument();
		await expect(canvas.getByText('zod4-mock')).toBeInTheDocument();
		await expect(canvas.getByText('--accent')).toBeInTheDocument();
	}}
>
	<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:16px">
		{#each [
			['--bg-base','Base'],['--bg-raised','Raised'],['--bg-overlay','Overlay'],
			['--text-primary','Primary'],['--text-muted','Muted'],['--border','Border'],
			['--accent','Accent'],['--success','Success'],['--warning','Warning'],['--danger','Danger'],
			['--lib-zod4mock','zod4-mock'],['--lib-zodmock','zod-mock'],['--lib-faker','faker']
		] as [token, label]}
			<div>
				<div style="width:100%;height:40px;border-radius:6px;background:var({token});border:1px solid var(--border)"></div>
				<div style="margin-top:4px;font-size:11px;color:var(--text-muted)">{label}</div>
				<div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted)">{token}</div>
			</div>
		{/each}
	</div>
</Story>
