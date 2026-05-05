<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ModPill from './ModPill.svelte';

	const { Story } = defineMeta({
		title: 'Builder/ModPill',
		component: ModPill,
		tags: ['autodocs']
	});
</script>

<Story name="Parameterless" args={{ name: '.email()' }} />

<Story name="Parameterized" args={{ name: '.min', value: 1 }} />

<Story name="Warn State" args={{ name: '"US"', warn: true }} />

<Story name="Removable" args={{ name: '.optional()', removable: true }} />

<Story name="Regex" args={{ name: '.regex', value: '/^[0-9]{5}$/' }} />
