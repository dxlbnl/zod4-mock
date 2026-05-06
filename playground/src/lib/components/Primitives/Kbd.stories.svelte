<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Kbd from './Kbd.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/Kbd',
		component: Kbd,
		parameters: {
			docs: {
				description: {
					component: `
Keyboard hints.

### Rules
- Always pair with a verb in the same line: \`"⌘ ⏎ download"\`. 
- Never used in isolation as a primary CTA.`
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="Command K" args={{ keys: '⌘ K' }} />
<Story name="Enter" args={{ keys: '⏎' }} />
<Story name="Escape" args={{ keys: 'esc' }} />
<Story name="Arrows" args={{ keys: '↑↓' }} />
