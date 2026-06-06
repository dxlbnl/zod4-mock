<script module lang="ts">
	// B100 chrome stories — sidebar layout, /docs landing, stub routes,
	// pagefind attributes. Each story is the runtime assertion for one
	// of B100-R10, B100-R11, B100-R13, and B100-R15.
	//
	// The structural file-presence + grep checks live in
	// site/src/lib/docs/B100-files.test.ts; these stories cover the
	// observable browser behaviour the spec specifies.

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import DocsLayout from '../../../routes/docs/+layout.svelte';
	import DocsLanding from '../../../routes/docs/+page.svelte';

	const { Story } = defineMeta({
		title: 'B100/Chrome',
		component: DocsLayout,
		tags: ['!autodocs']
	});
</script>

<Story
	name="B100-R10 / layout consumes SIDEBAR, aria-current=page, data-pagefind-ignore"
	play={async ({ canvasElement }) => {
		// The <aside> sidebar carries data-pagefind-ignore (B104 search ignores nav).
		const aside = canvasElement.querySelector('aside');
		await expect(aside, 'expected the layout to render an <aside> sidebar').toBeTruthy();
		await expect(aside?.hasAttribute('data-pagefind-ignore')).toBe(true);

		// At least one sidebar link is rendered (the SIDEBAR manifest produced them).
		const sidebarLinks = aside?.querySelectorAll('a') ?? [];
		await expect(sidebarLinks.length).toBeGreaterThan(0);

		// The link matching the current pathname carries aria-current="page".
		// Storybook's SvelteKit harness sets the pathname; assert at least one
		// rendered sidebar link carries aria-current="page" so the implementer
		// has to wire the active-route logic.
		const currentLinks = Array.from(sidebarLinks).filter(
			(a) => a.getAttribute('aria-current') === 'page'
		);
		await expect(currentLinks.length, 'one sidebar link must carry aria-current="page"').toBe(1);
	}}
>
	<DocsLayout>
		<p>page body</p>
	</DocsLayout>
</Story>

<Story
	name="B100-R11 / /docs landing renders a card-grid with one card per SIDEBAR group"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// A real <h1> (no 307 redirect).
		await expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
		// Exactly four group cards — one per concepts / reference / guides / how-to.
		const cardLinks = Array.from(canvasElement.querySelectorAll('a')).filter((a) =>
			(a.getAttribute('href') ?? '').startsWith('/docs/')
		);
		await expect(cardLinks.length, 'landing must render at least four group entry links').toBeGreaterThanOrEqual(4);
	}}
>
	<DocsLanding />
</Story>

<!--
	B100-R13's runtime story (the /docs/concepts stub rendering a "canonical
	reference" link) was retired by B101: B101-R6 rebuilds /docs/concepts from
	a link-only stub into a bespoke <DocPage>, so the canonical-reference link
	no longer exists. The structural file-presence guard for the remaining
	stubs lives in site/src/lib/docs/B100-files.test.ts (B100-R13 describe).
-->

<Story
	name="B100-R15 / chrome ignored + prose marked for Pagefind"
	play={async ({ canvasElement }) => {
		// Inside the layout, the prose container carries data-pagefind-body
		// exactly once and the <aside> carries data-pagefind-ignore.
		const bodyEls = canvasElement.querySelectorAll('[data-pagefind-body]');
		await expect(bodyEls.length, 'exactly one [data-pagefind-body] container').toBe(1);
		const asides = canvasElement.querySelectorAll('aside');
		for (const aside of asides) {
			await expect(
				aside.hasAttribute('data-pagefind-ignore'),
				'every <aside> in the layout must carry data-pagefind-ignore'
			).toBe(true);
		}
	}}
>
	<DocsLayout>
		<DocsLanding />
	</DocsLayout>
</Story>
