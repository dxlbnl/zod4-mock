<script module lang="ts">
	// B100-R1 — <DocPage> page shell.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: shell renders title + prose + on-this-page rail;
	// edit-on-GitHub link; page shell ships a Storybook story).
	//
	// Red until site/src/lib/docs/widgets/DocPage.svelte exists with the
	// typed Props {title, sidebarGroup, order, prerequisites?, related?,
	// editPath?} and renders <h1>title, a [data-pagefind-body] container,
	// an "On this page" right rail with one link per <h2>, and an
	// "Edit on GitHub" link when editPath is provided.

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import DocPage from './DocPage.svelte';

	const { Story } = defineMeta({
		title: 'Docs/DocPage',
		component: DocPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="B100-R1 / shell renders title + prose + on-this-page rail"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// <h1>title.
		await expect(
			canvas.getByRole('heading', { level: 1, name: 'Getting Started' })
		).toBeInTheDocument();

		// Prose container exposes [data-pagefind-body] for B104 indexing.
		await expect(canvasElement.querySelector('[data-pagefind-body]')).toBeInTheDocument();

		// On-this-page rail has one link per <h2>.
		const installLink = canvas.getByRole('link', { name: 'Install' });
		await expect(installLink.getAttribute('href')).toBe('#install');
		const generateLink = canvas.getByRole('link', { name: 'Generate' });
		await expect(generateLink.getAttribute('href')).toBe('#generate');
	}}
>
	<DocPage title="Getting Started" sidebarGroup="concepts" order={1}>
		<h2 id="install">Install</h2>
		<p>Install body.</p>
		<h2 id="generate">Generate</h2>
		<p>Generate body.</p>
	</DocPage>
</Story>

<Story
	name="B100-R1 / edit-on-GitHub link"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editLink = canvas.getByRole('link', { name: /edit on github/i });
		await expect(editLink).toBeInTheDocument();
		await expect(editLink.getAttribute('href') ?? '').toMatch(/docs\/getting-started\.md$/);
	}}
>
	<DocPage
		title="Getting Started"
		sidebarGroup="concepts"
		order={1}
		editPath="docs/getting-started.md"
	>
		<p>Body.</p>
	</DocPage>
</Story>
