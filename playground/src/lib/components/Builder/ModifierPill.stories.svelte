<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import ModifierPill from './ModifierPill.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'Builder/ModifierPill',
		component: ModifierPill,
		parameters: {
			docs: {
				description: {
					component: `
A Zod modifier (\`.min(1)\`, \`.email()\`, \`.optional()\`). Two shapes: parameterless (\`.email()\`) and parameterized (\`.min(1)\`).

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

<Story name="Parameterized" args={{ name: '.min', value: 1, index: 0, onchange: fn() }} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);
	const val = canvas.getByText('1');
	
	// MP-1: Enter edit mode
	await userEvent.click(val);
	await tick();
	const pill = canvas.getByTestId('modifier-pill');
	await expect(pill).toHaveAttribute('data-editing', 'true');

	// MP-2: Commit change with Enter
	await userEvent.clear(val);
	await userEvent.type(val, '5{enter}');
	await tick();
	await expect(args.onchange).toHaveBeenCalledWith('5');
	await expect(pill).toHaveAttribute('data-editing', 'false');
}} />

<Story name="Cancel Edit" args={{ name: '.max', value: 10, index: 0, onchange: fn() }} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);
	const val = canvas.getByText('10');
	
	await userEvent.click(val);
	await userEvent.clear(val);
	await userEvent.type(val, '20{escape}');
	await tick();
	
	// Should revert to 10
	await expect(canvas.getByText('10')).toBeInTheDocument();
	await expect(args.onchange).not.toHaveBeenCalled();
}} />

<Story name="Warn State" args={{ name: '"US"', warn: true }} />

<Story name="Removable" args={{ name: '.optional()', removable: true, onremove: fn() }} />

<Story name="Enum Value" args={{ name: 'admin', kind: 'enum', removable: true, onremove: fn(), onchange: fn() }} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);
	const val = canvas.getByText('admin');
	
	// MP-E1: Enter edit mode
	await userEvent.click(val);
	await tick();
	const pill = canvas.getByTestId('modifier-pill');
	await expect(pill).toHaveAttribute('data-editing', 'true');

	// MP-E2: Commit change with Enter
	await userEvent.clear(val);
	await userEvent.type(val, 'superuser{enter}');
	await tick();
	await expect(args.onchange).toHaveBeenCalledWith('superuser');
	await expect(pill).toHaveAttribute('data-editing', 'false');
}} />

<Story name="Regex" args={{ name: '.regex', value: '/^[0-9]{5}$/', index: 0 }} />
