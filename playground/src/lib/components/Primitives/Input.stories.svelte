<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Input from './Input.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/Input',
		component: Input,
		parameters: {
			docs: {
				description: {
					component: 'Single utility input used in left-rail fields and search boxes. Mono 11px, 22px tall.'
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ value: 'seed_42', placeholder: 'Enter seed…' }} />

<Story name="With Label" args={{ label: 'seed', value: 'seed_42' }} />

<Story name="Focus State" args={{ label: 'active', value: 'active', autofocus: true }} />
