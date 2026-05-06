<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LeftRail from './LeftRail.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/LeftRail',
		component: LeftRail,
		parameters: {
			docs: {
				description: {
					component: '264px wide. Three accordion sections: World, Subjects (always primary), Schemas. Subjects expands to fill remaining vertical space.'
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="LeftRail" />
