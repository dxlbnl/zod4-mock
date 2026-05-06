<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import Button from './Button.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/Button',
		component: Button,
		parameters: {
			docs: {
				description: {
					component: `
Three variants. All 26px tall. Primary uses \`--accent-dim\`, default uses \`--bg-2\`, ghost is transparent. Icons are 12–13px and always Lucide-style.

### Rules
- Only one \`.primary\` per pane region. Top bar's "Export" is the global primary.
- Use \`.ghost\` for icon-only top-bar actions (refresh, theme toggle).
- Never put \`.primary\` inside a row or pill — primary is always full-button-sized.`
				}
			}
		},
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: { type: 'select' },
				options: ['default', 'primary', 'ghost']
			}
		},
		args: {
			onclick: fn()
		}
	});
</script>

<Story name="Default" args={{ label: 'Button' }} play={async ({ args, canvasElement }) => {
	args.onclick.mockClear();
	const canvas = within(canvasElement);
	const button = canvas.getByRole('button');
	await userEvent.click(button);
	await expect(args.onclick).toHaveBeenCalled();
}} />

<Story name="Primary" args={{ variant: 'primary', label: 'Run' }} />

<Story name="Ghost" args={{ variant: 'ghost', label: 'Skip' }} />

<Story name="Disabled" args={{ disabled: true, label: 'Disabled' }} play={async ({ args, canvasElement }) => {
	args.onclick.mockClear();
	const canvas = within(canvasElement);
	const button = canvas.getByRole('button');
	await userEvent.click(button);
	await expect(args.onclick).not.toHaveBeenCalled();
}} />

<Story name="With Icon" args={{ variant: 'primary', label: '+ Add subject' }} />
