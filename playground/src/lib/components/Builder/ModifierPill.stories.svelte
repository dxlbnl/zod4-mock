<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ModifierPill from './ModifierPill.svelte';

	const { Story } = defineMeta({
		title: 'Builder/ModifierPill',
		component: ModifierPill,
		parameters: {
			docs: {
				description: {
					component: `
A Zod modifier (\`.min(1)\`, \`.email()\`, \`.optional()\`). Two shapes: parameterless (\`.email()\`) and parameterized (\`.min=1\`).

### States
- **default**: No special styling.
- **parameterized**: Value editable in place.
- **hover**: Accent border + close × appears.
- **warn**: Unbound enum value, mismatch (orange variant).`
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="Parameterless" args={{ name: '.email()' }} />

<Story name="Parameterized" args={{ name: '.min', value: 1 }} />

<Story name="Warn State" args={{ name: '"US"', warn: true }} />

<Story name="Removable" args={{ name: '.optional()', removable: true }} />

<Story name="Regex" args={{ name: '.regex', value: '/^[0-9]{5}$/' }} />
