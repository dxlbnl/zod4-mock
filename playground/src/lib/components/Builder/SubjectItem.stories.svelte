<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SubjectItem from './SubjectItem.svelte';

	const { Story } = defineMeta({
		title: 'Builder/SubjectItem',
		component: SubjectItem,
		parameters: {
			docs: {
				description: {
					component: 'A selectable item used in the LeftRail to represent a top-level schema subject.'
				}
			}
		},
		tags: ['autodocs'],
		args: {
			name: 'User',
			count: 6,
			selected: false
		}
	});
</script>

<Story name="Default" />

<Story name="Selected" args={{ selected: true }} />

<Story name="With Badge" args={{ name: 'Order', count: 4, badge: 'FK→User' }} />
