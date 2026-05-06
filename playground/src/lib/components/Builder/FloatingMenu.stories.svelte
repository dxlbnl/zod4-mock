<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FloatingMenu from './FloatingMenu.svelte';

	const { Story } = defineMeta({
		title: 'Builder/FloatingMenu',
		component: FloatingMenu,
		parameters: {
			docs: {
				description: {
					component: `
The picker that opens when you click a \`+ mod\` pill. Anchored 8px below the pill with an upward caret. Width 256px.

### Behavior
- Anchored to the pill via \`getBoundingClientRect()\`; uses \`position: fixed\` so it escapes overflow:auto parents.
- Caret horizontal offset is computed: \`--caret: anchorCenter - menuLeft - 5px\`.
- Search auto-focuses on open. \`esc\` closes; \`⏎\` adds the highlighted item.
- Items grouped by category; the search filters across all categories.
- The \`scope\` chip shows which Zod base type the menu's options apply to.`
				}
			}
		},
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
