<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FloatMenu from './FloatMenu.svelte';

	const { Story } = defineMeta({
		title: 'Builder/FloatMenu',
		component: FloatMenu,
		tags: ['autodocs'],
		args: {
			scope: 'z.number()',
			items: [
				{ name: '.positive()', desc: '> 0', category: 'Refinements' },
				{ name: '.negative()', desc: '< 0', category: 'Refinements' },
				{ name: '.finite()', desc: 'no Infinity', category: 'Refinements' },
				{ name: '.nullable()', desc: 'allow null', category: 'Wrappers' },
				{ name: '.default(…)', desc: 'fallback', category: 'Wrappers' }
			]
		}
	});
</script>

<Story name="Default" />

<Story name="Custom Caret" args={{ caretOffset: 40 }} />
