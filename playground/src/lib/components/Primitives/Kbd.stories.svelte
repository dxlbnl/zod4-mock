<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Kbd from './Kbd.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/Kbd',
		component: Kbd,
		tags: ['autodocs']
	});
</script>

<Story name="Command K" args={{ keys: '⌘ K' }} />
<Story name="Enter" args={{ keys: '⏎' }} />
<Story name="Escape" args={{ keys: 'esc' }} />
<Story name="Arrows" args={{ keys: '↑↓' }} />
