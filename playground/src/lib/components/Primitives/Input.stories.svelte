<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Input from './Input.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/Input',
		component: Input,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ value: 'seed_42', placeholder: 'Enter seed…' }} />

<Story name="With Label" args={{ label: 'seed', value: 'seed_42' }} />

<Story name="Focus State" args={{ label: 'active', value: 'active', autofocus: true }} />
