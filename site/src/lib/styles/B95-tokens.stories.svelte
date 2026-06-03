<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';

	// B95-R3 / Phosphor default, Paper palette flip — runtime check.
	//
	// Storybook's preview imports site/src/lib/styles/app.css globally
	// (see .storybook/preview.ts). After R2, app.css pulls in
	// @dxlbnl/ui/tokens/tokens.css which defines the Phosphor (dark)
	// values on :root and the Paper (light) values under
	// [data-palette="paper"]. This story asserts both states by reading
	// computed --bg + the library's --u spacing token.

	const { Story } = defineMeta({
		title: 'B95/Tokens',
		tags: ['!autodocs']
	});

	function parseRgb(value: string): [number, number, number] | null {
		const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
		if (!m) return null;
		return [Number(m[1]), Number(m[2]), Number(m[3])];
	}

	function isDark(rgb: [number, number, number]): boolean {
		// Phosphor --bg is #0b0d0c (very dark) — luma well below the midpoint.
		const [r, g, b] = rgb;
		const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		return luma < 64;
	}

	function isLight(rgb: [number, number, number]): boolean {
		// Paper --bg is #efece4 — luma well above the midpoint.
		const [r, g, b] = rgb;
		const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		return luma > 200;
	}
</script>

<Story
	name="B95-R3 palette flip + R2 token resolution"
	play={async () => {
		const html = document.documentElement;
		// Start from a known state.
		html.removeAttribute('data-palette');

		// R2 — UI runtime: the library's --u (8px base) resolves to a non-empty value.
		const uValue = getComputedStyle(html).getPropertyValue('--u').trim();
		await expect(uValue, '--u from @dxlbnl/ui/tokens/tokens.css must resolve').not.toBe('');

		// R3 — default palette is Phosphor: --bg resolves to a dark colour.
		const defaultBg = getComputedStyle(html).getPropertyValue('--bg').trim();
		await expect(defaultBg, 'expected --bg to be defined in the default palette').not.toBe('');
		// Materialise the colour on a probe element so getComputedStyle resolves it to rgb().
		const probe = document.createElement('div');
		probe.style.background = `var(--bg)`;
		document.body.appendChild(probe);
		try {
			const phosphor = parseRgb(getComputedStyle(probe).backgroundColor);
			await expect(phosphor, 'expected --bg to resolve to a rgb() colour').not.toBeNull();
			await expect(isDark(phosphor!), `default --bg expected dark, got ${phosphor!.join(',')}`).toBe(true);

			// R3 — flip to Paper: --bg flips to a light colour without reload.
			html.setAttribute('data-palette', 'paper');
			const paper = parseRgb(getComputedStyle(probe).backgroundColor);
			await expect(paper, 'expected Paper --bg to resolve to a rgb() colour').not.toBeNull();
			await expect(isLight(paper!), `paper --bg expected light, got ${paper!.join(',')}`).toBe(true);
		} finally {
			probe.remove();
			html.removeAttribute('data-palette');
		}
	}}
/>
